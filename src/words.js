const path = require('path');
const {writeFile} = require('fs/promises');
const words = require('../config/SavedWords.json');

const wordsPath = path.join(__dirname, '..', 'config', 'SavedWords.json');

function getWord(polish, sentence) {
    if (!polish || !sentence) {
        console.error(new TypeError(`Tried to get word using nullish value! Aborting!`));
        console.error({polish, sentence});
    }
    return words.filter(obj => obj.polish === polish);
}

async function insertWord(polish, english, sentence) {
    if (!polish || !english || !sentence) {
        console.error(new TypeError(`Tried to insert nullish value! Aborting!`));
        console.error({polish, english, sentence});
        return;
    }
    return words.push({polish, english, sentence});
}

async function saveWords() {
    return writeFile(wordsPath, JSON.stringify(words, null, 4), {encoding: 'utf8'});
}

function getAllWords() {
    return words;
}

module.exports = {
    getAllWords: getAllWords,
    getWord: getWord,
    insertWord: insertWord,
    saveWords: saveWords
};