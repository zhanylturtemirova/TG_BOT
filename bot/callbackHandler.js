const { platformConfig } = require('../config/platforms');
const SelectionStore = require('../services/SelectionStore');
const { createFormatKeyboard, createProgressMessage, createErrorMessage } = require('../services/UIService');
const { deleteMessages } = require('./messageCleanup');
const { runDownloadJob } = require('./downloadJob');

function parseChoice(data, platform) {
    const config = platformConfig[platform];
    if (data === 'audio' && config.supportedFormats.includes('audio')) return { format: 'audio' };
    const resolution = data.startsWith('video_') ? data.slice('video_'.length) : null;
    if (resolution && config.videoResolutions.includes(resolution)) return { format: 'video', resolution };
    return null;
}

function createCallbackHandler(dependencies) {
    const { selections, queue, logger } = dependencies;
    return async ctx => {
        if (!ctx.chat) return ctx.answerCallbackQuery('Отправьте новую ссылку.');
        const ownerId = SelectionStore.ownerId(ctx);
        const messageId = ctx.callbackQuery.message?.message_id;
        const pending = selections.get(ownerId);
        if (!pending || pending.selectionMessageId !== messageId) {
            return ctx.answerCallbackQuery('Это меню устарело. Отправьте ссылку ещё раз.');
        }
        const action = ctx.callbackQuery.data;
        const choice = parseChoice(action, pending.downloader.platform);
        if (!choice && !['cancel', 'delete_message'].includes(action)) {
            return ctx.answerCallbackQuery('Неизвестный формат. Выберите кнопку из меню.');
        }
        const selection = selections.take(ownerId, messageId);
        await ctx.answerCallbackQuery();

        if (action === 'cancel') {
            await ctx.reply('Скачивание отменено.');
            return deleteMessages(ctx, [messageId], logger);
        }
        if (action === 'delete_message') {
            await deleteMessages(ctx, [selection.userMessageId, messageId], logger);
            return;
        }

        const temporaryMessages = [messageId];
        try {
            const progress = await ctx.reply(createProgressMessage(
                selection.info.platform, choice.format, choice.resolution, 'В очереди'
            ));
            temporaryMessages.push(progress.message_id);
            await queue.addJob(
                () => runDownloadJob(ctx, selection, choice, progress.message_id, dependencies), ownerId
            );
        } catch (error) {
            logger.error('Download failed', error);
            await ctx.reply(createErrorMessage(error));
            if (error.code === 'FILE_TOO_LARGE' && !selections.get(ownerId)) {
                const ticket = selections.begin(ownerId);
                const menu = await ctx.reply('Выберите другое качество или аудио:', {
                    reply_markup: createFormatKeyboard(selection.info.platform)
                });
                selections.complete(ownerId, ticket, {
                    downloader: selection.downloader, info: selection.info,
                    userMessageId: selection.userMessageId, selectionMessageId: menu.message_id
                });
            }
        } finally {
            await deleteMessages(ctx, temporaryMessages, logger);
        }
    };
}

module.exports = { createCallbackHandler };
