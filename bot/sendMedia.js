const path = require('node:path');
const { InputFile } = require('grammy');

async function sendMedia(ctx, result, info, format) {
    const title = info.title || 'Video';
    const filename = title.replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').slice(0, 80);
    const extension = path.extname(result.filePath);
    const input = new InputFile(result.filePath, `${filename}${extension}`);
    const caption = title.slice(0, 1024);
    if (format === 'audio') {
        return ctx.replyWithAudio(input, { performer: info.uploader, title: title.slice(0, 64), caption });
    }
    if (extension === '.mp4') {
        return ctx.replyWithVideo(input, { caption, supports_streaming: true });
    }
    return ctx.replyWithDocument(input, { caption });
}

module.exports = { sendMedia };
