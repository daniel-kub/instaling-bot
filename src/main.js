const puppeteer = require('puppeteer');
const config = require('../config/Config.json');
const {type, click, delay, getRandomInt, canLogin, savePage, prepare, eventer} = require('./helpers.js');
const {green, yellow, red, blue, error} = require('./printer.js');
const chalk = require('chalk');
const {insertWord, saveWords, getAllWords} = require('./words.js');
const {InstalingApi, SessionComplete} = require('./api.js');

const blockedHosts = [
    'googletagmanager.com',
    'google-analytics.com',
    'googlesyndication.com',
    'googleadservices.com',
    'adservice.google.com',
    'fundingchoicesmessages.google.com',
    'doubleclick.net',
    'tags.refinery89.com',
    'refinery89.com',
    'uptimiarum.eu'
];

let i = 0;
let api;

// MAIN
(async () => {
    let page;
    try {
        if (!canLogin) {
            red('Please type in config/Config.json your login and password!');
            return;
        }

        page = await start();
        const studentId = await login(page);
        api = new InstalingApi(page, studentId);
        await startSession(page);

        try {
            const wordMap = await loadWords();
            while (true) {
                await answerQuestion(wordMap);
            }
        } catch (e) {
            if (!(e instanceof SessionComplete)) {
                throw e;
            }
        }

        await handleFinish(page, 0);
    } catch (err) {
        error(err);
        await savePage(page, 'error');
        await handleFinish(page, 1);
    }
})();

async function start() {
    const options = {
        headless: config.show_browser ? false : 'shell',
        devtools: config.open_devtools,
        defaultViewport: null,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--window-size=1366,900'
        ]
    };

    if (config.mute_audio) {
        options.args.push('--mute-audio');
    }

    const [browser] = await Promise.all([
        puppeteer.launch(options),
        prepare()
    ]);
    const pages = await browser.pages();
    const page = pages[0] ?? await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (blockedHosts.some(host => url.includes(host))) {
            request.abort();
        } else {
            request.continue();
        }
    });

    return page;
}

// STEPS
async function login(page) {
    if (config.debug) {
        page.on('console', message => console.log(`${message.type().slice(0, 3).toUpperCase()} ${message.text()}`))
            .on('pageerror', ({message}) => console.log(message))
            .on('response', response => console.log(`${response.status()} ${response.url()}`))
            .on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`))
    }

    page.on('dialog', async dialog => {
        red(`Dialog: \`${dialog.message()}\``);
        if (dialog.message() === 'Błąd połączenia') {
            error(new Error('Błąd połączenia'));
            eventer.emit('stopBot', 1);
        }
        await dialog.dismiss();
    });

    blue(`[LOGIN] Logging in as \`${config.login}\`...`);
    await page.goto(config.sites.login, {waitUntil: 'domcontentloaded'});

    await type(page, '#log_email', config.login);
    await type(page, '#log_password', config.password);

    await click(page, '#main-container form button[type="submit"]');
    green('[LOGIN] Submitted!');

    const studentId = await getStudentId(page);
    if (!studentId) {
        red(`[LOGIN] Login failed (url: \`${chalk.white(page.url())}\`) - check the login and password in config/Config.json!`);
        throw new Error('Login failed');
    }
    green(`[LOGIN] Logged in as \`${config.login}\` (student ${studentId})!`);
    return studentId;
}

async function startSession(page) {
    blue('[START] Starting...');
    try {
        await api.initSession();
        green('[START] Session initiated!');
    } catch (e) {
        yellow('[START] Could not initiate session, continuing anyway...');
    }
}

async function loadWords() {
    blue('[WORDS] Loading words to repeat...');
    const {json} = await api.getWordsToRepeat();
    const wordMap = normalizeWordsToRepeat(json);
    yellow(`[WORDS] Loaded ${wordMap.size} words`);
    return wordMap;
}

async function answerQuestion(wordMap) {
    i++;
    blue(`[ANSWER ${i}] Generating word...`);

    const {json, text} = await api.generateNextWord();
    if (!json) {
        red(`[ANSWER ${i}] Unexpected response from generate_next_word: ${String(text).substring(0, 300)}`);
        throw new Error('generate_next_word returned an unexpected response');
    }
    if (json.id == null) {
        const summary = typeof json.summary === 'string' ? json.summary : '';
        yellow(`[ANSWER ${i}] Session finished!${summary ? ` ${summary.substring(0, 300)}` : ''}`);
        throw new SessionComplete();
    }

    const wordId = String(json.id);
    const fromMap = wordMap.get(wordId);
    const entry = {
        id: wordId,
        english: fromMap?.english ?? json.word ?? '',
        polish: typeof json.translations === 'string' ? json.translations : (json.translations?.join(', ') ?? ''),
        sentence: json.usage_example ?? fromMap?.sentence ?? ''
    };
    blue(`[ANSWER ${i}] Word #\`${chalk.white(wordId)}\` ${chalk.cyan(entry.english)}\n${chalk.white('↳')} ${entry.polish || '(no translation)'}`);

    let correct = config.answer_with === 'polish' ? (entry.polish ?? '') : (entry.english ?? '');
    if (!correct) {
        correct = entry.english ?? entry.polish ?? '';
    }

    let answer = '';
    if (correct) {
        const random = Math.random();
        if (random < config.valid_chance) {
            answer = correct;
            green(`[ANSWER ${i}] Answering correctly with: \`${chalk.cyan(answer)}\``);
        } else {
            answer = pickRandomWrong(wordMap, wordId) || correct;
            yellow(`[ANSWER ${i}] Answering incorrectly! (\`${chalk.white(random)}\` is higher than \`${chalk.cyan(config.valid_chance)}\`)`);
        }
    } else {
        red(`[ANSWER ${i}] No translation found for word #${wordId}, submitting empty answer!`);
    }

    const saved = await api.saveAnswer(wordId, answer);
    blue(`[ANSWER ${i}] Answer sent.`);
    if (config.debug && saved?.json) {
        blue(`[ANSWER ${i}] save_answer response: ${JSON.stringify(saved.json).substring(0, 400)}`);
    }

    await saveWord(entry);
    blue(`[ANSWER ${i}] Next word!`);
    await delay(getRandomInt(config.delays.next_word_min, config.delays.next_word_max));
}

async function handleFinish(page, code) {
    if (page) {
        blue('[STOP] Saving words...');
        try {
            await saveWords();
            green('[STOP] Words saved!');
        } catch (e) {
            console.error(e);
        }
        blue('[STOP] Closing...');
        await page.browser().close().catch(() => {});
    }

    green('Thanks for using InstaLing Bot by PanSzelescik');
    green('https://github.com/PanSzelescik/instaling-bot');
    eventer.emit('stopBot', code);
}

function normalizeWordsToRepeat(data) {
    const wordMap = new Map();
    if (!Array.isArray(data)) {
        red('[WORDS] Unexpected response from repeat_words_ajax: ' + JSON.stringify(data).substring(0, 200));
        return wordMap;
    }
    for (const item of data) {
        const id = item?.word_id ?? item?.id;
        if (id == null) continue;
        const english = item?.word ?? item?.english ?? item?.en ?? item?.word_en ?? '';
        const polish = item?.translations ?? item?.translation ?? item?.polish ?? item?.pl ?? '';
        const sentence = item?.usage_example ?? item?.sentence ?? item?.example ?? '';
        wordMap.set(id, {english, polish, sentence});
    }
    return wordMap;
}

function pickRandomWrong(wordMap, excludeId) {
    const ids = [...wordMap.keys()].filter(id => id !== excludeId);
    if (!ids.length) return undefined;
    const entry = wordMap.get(ids[getRandomInt(0, ids.length)]);
    return config.answer_with === 'polish' ? (entry?.polish ?? '') : (entry?.english ?? '');
}

async function saveWord(entry) {
    if (!entry?.polish || !entry?.english || !entry?.sentence) return;
    const exists = getAllWords().some(word => word.polish === entry.polish && word.english === entry.english);
    if (!exists) {
        await insertWord(entry.polish, entry.english, entry.sentence);
    }
}

async function getStudentId(page) {
    const studentId = await page.evaluate(() => {
        const url = new URL(location.href);
        const fromUrl = url.searchParams.get('student_id');
        if (fromUrl) return fromUrl;
        return document.querySelector('input[name="student_id"]')?.value ?? null;
    });
    if (studentId) return studentId;
    const cookieStudentId = (await page.cookies()).find(cookie => /student_id/i.test(cookie.name));
    return cookieStudentId?.value ?? null;
}