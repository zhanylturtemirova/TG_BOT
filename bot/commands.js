const { createQueueMessage } = require('../services/UIService');
const SelectionStore = require('../services/SelectionStore');

function registerCommands(bot, { queue, donationUrl }) {
    bot.command('start', ctx => {
        const donation = donationUrl ? `\nПоддержать бота: ${donationUrl}` : '';
        return ctx.reply(`Пришлите ссылку YouTube, Instagram или TikTok. Выберите видео нужного качества или только аудио.${donation}`);
    });
    bot.command('queue', ctx => ctx.reply(createQueueMessage(queue.getStatus(SelectionStore.ownerId(ctx)))));
    bot.on('message:voice', ctx => ctx.reply('Пришлите текстовую ссылку на видео. Голосовые сообщения не поддерживаются.'));
}

module.exports = { registerCommands };
