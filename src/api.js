const SESSION_VERSION = 'C65E24B29A31C9931AD11AAA9C9707D2';

class SessionComplete extends Error {}

class InstalingApi {
    constructor(page, studentId) {
        this.page = page;
        this.studentId = studentId;
        this.base = 'https://instaling.pl';
        this.sessionBase = '/app/session/server/actions/';
    }

    async request(path, params = {}, method = 'POST') {
        const url = this.base + path;
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const result = await this.page.evaluate(async ({url, method, params}) => {
                    const body = new URLSearchParams(params).toString();
                    const response = await fetch(url, {
                        method,
                        headers: method === 'POST' ? {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'} : {},
                        body: method === 'POST' ? body : undefined
                    });
                    const text = await response.text();
                    let json = null;
                    try {
                        json = JSON.parse(text);
                    } catch (e) {}
                    return {status: response.status, text, json};
                }, {url, method, params});
                if (result.status < 500) {
                    return result;
                }
                lastError = new Error(`HTTP ${result.status} for ${path}`);
            } catch (e) {
                lastError = e;
            }
            await new Promise(r => setTimeout(r, 700 * attempt));
        }
        throw lastError;
    }

    async initSession() {
        return this.request(this.sessionBase + 'init_session.php', {
            child_id: this.studentId,
            start: '',
            end: ''
        });
    }

    async getWordsToRepeat(limit = 300) {
        const query = new URLSearchParams({
            action: 'getWordsToRepeat',
            student_id: this.studentId,
            group_id: 0,
            limit
        }).toString();
        return this.request(`/learning/repeat_words_ajax.php?${query}`, {}, 'GET');
    }

    async generateNextWord() {
        return this.request(this.sessionBase + 'generate_next_word.php', {
            child_id: this.studentId,
            date: Date.now()
        });
    }

    async saveAnswer(wordId, answer) {
        return this.request(this.sessionBase + 'save_answer.php', {
            child_id: this.studentId,
            word_id: wordId,
            answer: answer ?? '',
            version: SESSION_VERSION
        });
    }
}

module.exports = {
    InstalingApi,
    SessionComplete
};