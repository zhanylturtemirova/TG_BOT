const { Bot } = require('grammy');
const DownloaderFactory = require('../downloaders/DownloaderFactory');
const { DownloadService } = require('../services/DownloadService');
const DownloadQueue = require('../services/DownloadQueue');
const SelectionStore = require('../services/SelectionStore');
const { getTelegramConfig } = require('../config/telegram');
const { registerCommands } = require('./commands');
const { createLinkHandler } = require('./linkHandler');
const { createCallbackHandler } = require('./callbackHandler');

function createBot({
    token,
    telegram = getTelegramConfig(),
    factory = DownloaderFactory,
    downloadService = new DownloadService(telegram),
    queue = new DownloadQueue(2),
    selections = new SelectionStore(),
    logger = console,
    donationUrl,
    botInfo
} = {}) {
    if (!token) throw new Error('Set BOT_API_KEY in .env before starting the bot.');
    const bot = new Bot(token, {
        botInfo,
        client: { apiRoot: telegram.apiRoot, timeoutSeconds: telegram.timeoutSeconds }
    });
    const dependencies = { factory, downloadService, queue, selections, logger, donationUrl };
    registerCommands(bot, dependencies);
    bot.on('message:text', createLinkHandler(dependencies));
    bot.on('callback_query:data', createCallbackHandler(dependencies));
    bot.catch(({ error }) => logger.error('Telegram update failed', error));
    return bot;
}

module.exports = { createBot };
