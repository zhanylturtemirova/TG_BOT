const { createProgressMessage } = require('../services/UIService');
const { sendMedia } = require('./sendMedia');

async function runDownloadJob(ctx, selection, choice, progressMessageId, { downloadService, logger }) {
    const { downloader, info } = selection;
    const { format, resolution } = choice;
    const updateProgress = async stage => {
        try {
            await ctx.api.editMessageText(ctx.chat.id, progressMessageId,
                createProgressMessage(info.platform, format, resolution, stage));
        } catch (error) {
            logger.warn('Unable to update progress', error.message);
        }
    };

    let result;
    try {
        await updateProgress('Скачиваю');
        result = await downloadService.downloadContent(downloader, format, resolution, ctx.from.id);
        await updateProgress('Отправляю');
        await sendMedia(ctx, result, info, format);
    } finally {
        if (result) await downloadService.cleanup(result.downloadId);
    }
}

module.exports = { runDownloadJob };
