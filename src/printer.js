const chalk = require('chalk');
const config = require('../config/Config.json');
const {WebhookClient, EmbedBuilder} = require('discord.js');
const stripAnsi = require('strip-ansi');

let webhook = undefined;
let string = '';
let interval;
prepareWebhook();

function log(text) {
    string += '\n';
    string += text;
    console.log(text);
}

function green(text) {
    return log(chalk.green(text));
}

function yellow(text) {
    return log(chalk.yellow(text));
}

function red(text) {
    return log(chalk.red(text));
}

function blue(text) {
    return log(chalk.blue(text));
}

function error(text) {
    sendAndClear().catch(console.error);
    webhook?.send?.({
        embeds: [new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`Błąd: ${text?.name}`)
            .addFields(
                {name: 'Message', value: String(text?.message ?? text).substring(0, 1024) || '—', inline: false},
                {name: 'Text', value: String(text).substring(0, 1024) || '—', inline: false},
                {name: 'Stacktrace', value: String(text?.stack ?? '').substring(0, 1024) || '—', inline: false}
            )
            .setDescription('Wystąpił nieznany błąd i bot został zatrzymany!')
            .setFooter({text: 'InstaLing Bot by PanSzelescik'})
            .setTimestamp(new Date())]
    }).catch(console.error);
    console.error(text);
}

function prepareWebhook() {
    if (config?.webhook) {
        const splitted = config.webhook.split('/');
        const id = splitted[splitted.length - 2];
        const token = splitted[splitted.length - 1];
        if (id && token) {
            webhook = new WebhookClient({id, token});
            interval = setInterval(async () => sendAndClear(), 5000);
        }
    }
}

async function send(text) {
    return webhook?.send?.(stripAnsi(text));
}

async function sendAndClear() {
    if (string) {
        const toSend = string;
        string = '';
        return send(toSend);
    }
}

module.exports = {
    green,
    yellow,
    red,
    blue,
    error,
    interval,
    sendAndClear
}