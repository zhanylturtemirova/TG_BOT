const { InlineKeyboard } = require('grammy');
const { platformConfig } = require('../config/platforms');

function createFormatKeyboard(platform) {
    const config = platformConfig[platform.toLowerCase()];
    const keyboard = new InlineKeyboard();
    for (const format of config.supportedFormats) {
        if (format === 'audio') keyboard.text('🎵 Только аудио (MP3)', 'audio').row();
        if (format === 'video') {
            for (const resolution of config.videoResolutions) {
                const label = resolution === 'best' ? 'Лучшее качество' : `${resolution}p`;
                keyboard.text(`🎥 ${label}`, `video_${resolution}`).row();
            }
        }
    }
    return keyboard.text('🗑 Удалить ссылку', 'delete_message').row().text('Отмена', 'cancel');
}

function createProgressMessage(platform, format, resolution, stage) {
    const quality = format === 'video' && resolution !== 'best' ? ` ${resolution}p` : '';
    const media = format === 'audio' ? 'аудио' : 'видео';
    return `${stage}: ${platform}, ${media}${quality}…`;
}

function createErrorMessage(error) {
    if (error.code === 'FILE_TOO_LARGE') return `❌ ${error.message}`;
    const details = error.message || String(error);
    if (/cookies_file does not exist|ffmpeg|ffprobe|executable not found/i.test(details)) {
        return '❌ Ошибка настройки загрузчика. Сообщите владельцу бота.';
    }
    if (/login|log in|sign in|cookies|private|rate.limit|429/i.test(details)) {
        return '❌ Сервис требует вход или временно ограничил доступ. Проверьте, открывается ли ролик в браузере, или попробуйте позже.';
    }
    if (/does not contain a downloadable video/i.test(details)) {
        return '❌ В выбранной публикации нет видео для скачивания.';
    }
    if (/Requested format is not available/i.test(details)) {
        return '❌ Это качество недоступно. Отправьте ссылку ещё раз и выберите другое.';
    }
    return '❌ Не удалось скачать или отправить файл. Попробуйте ещё раз позже.';
}

function createQueueMessage(status) {
    const lines = [
        `Скачивается: ${status.activeDownloads}/${status.maxConcurrent}`,
        `В очереди: ${status.queueLength}`
    ];
    if (status.position) lines.push(`Ваше место: ${status.position}`);
    else if (status.userActive) lines.push('Ваш файл обрабатывается.');
    else lines.push('У вас нет загрузок в очереди.');
    return lines.join('\n');
}

module.exports = { createFormatKeyboard, createProgressMessage, createErrorMessage, createQueueMessage };
