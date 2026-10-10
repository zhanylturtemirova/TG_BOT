const SelectionStore = require('../services/SelectionStore');
const { createFormatKeyboard, createErrorMessage } = require('../services/UIService');

function extractLinks(message) {
    return (message.entities || []).flatMap(entity => {
        if (entity.type === 'text_link') return [entity.url];
        if (entity.type === 'url') return [message.text.slice(entity.offset, entity.offset + entity.length)];
        return [];
    });
}

function createLinkHandler({ factory, selections, logger }) {
    return async ctx => {
        const links = extractLinks(ctx.message);
        const url = links.find(link => factory.isSupported(link));
        if (!url) {
            await ctx.reply('Пришлите ссылку на видео YouTube, Instagram или TikTok.');
            return;
        }
        const ownerId = SelectionStore.ownerId(ctx);
        const ticket = selections.begin(ownerId);
        try {
            const downloader = factory.createDownloader(url);
            const info = await downloader.getInfo();
            if (!selections.isCurrent(ownerId, ticket)) return;
            const selectionMessage = await ctx.reply(`Выберите формат для «${info.title.slice(0, 500)}»:`, {
                reply_markup: createFormatKeyboard(info.platform)
            });
            selections.complete(ownerId, ticket, {
                downloader, info,
                userMessageId: ctx.message.message_id,
                selectionMessageId: selectionMessage.message_id
            });
        } catch (error) {
            logger.error('Unable to prepare download', error);
            if (selections.isCurrent(ownerId, ticket)) await ctx.reply(createErrorMessage(error));
        }
    };
}

module.exports = { createLinkHandler };
