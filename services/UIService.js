const { InlineKeyboard } = require('grammy');
const { platformConfig } = require('../config/platforms');

class UIService {
    static createFormatKeyboard(platform, title) {
        const config = platformConfig[platform.toLowerCase()];
        if (!config) {
            throw new Error(`Configuration not found for platform: ${platform}`);
        }

        const keyboard = new InlineKeyboard();

        // Add audio option if supported
        if (config.supportedFormats.includes('audio')) {
            keyboard.text("🎵 Audio", "audio").row();
        }

        // Add video resolution options if supported
        if (config.supportedFormats.includes('video')) {
            config.videoResolutions.forEach(resolution => {
                const label = resolution === 'best' ? '🎥 Video (Best)' : `🎥 Video ${resolution}p`;
                const callbackData = resolution === 'best' ? 'video_best' : `video_${resolution}`;
                keyboard.text(label, callbackData).row();
            });
        }

        // Add utility buttons
        keyboard
            .text("🗑️ Delete message", "delete_message")
            .row()
            .text("❌ Cancel", "cancel");

        return keyboard;
    }

    static createPlatformInfoMessage(platform, info) {
        const config = platformConfig[platform.toLowerCase()];
        const platformName = config ? config.name : platform;

        let message = `📹 **${platformName} Video**\n`;
        message += `📝 **Title:** ${info.title}\n`;
        message += `👤 **Uploader:** ${info.uploader}\n`;
        message += `⏱️ **Duration:** ${this.formatDuration(info.duration)}\n`;

        if (info.viewCount) {
            message += `👁️ **Views:** ${this.formatNumber(info.viewCount)}\n`;
        }

        if (info.uploadDate) {
            message += `📅 **Uploaded:** ${this.formatDate(info.uploadDate)}\n`;
        }

        return message;
    }

    static formatDuration(seconds) {
        if (!seconds) return 'Unknown';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    static formatNumber(num) {
        if (!num) return '0';

        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    static formatDate(dateString) {
        if (!dateString) return 'Unknown';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch {
            return dateString;
        }
    }

    static createProgressMessage(platform, format, resolution = null) {
        const config = platformConfig[platform.toLowerCase()];
        const platformName = config ? config.name : platform;

        let message = `⏳ Processing ${platformName} ${format}`;
        if (resolution && resolution !== 'best') {
            message += ` ${resolution}p`;
        }
        message += '...';

        return message;
    }

    static createErrorMessage(error, platform = null) {
        if (error.code === 'FILE_TOO_LARGE') return `❌ ${error.message}`;
        const details = error.message || String(error);
        if (/cookies_file does not exist/i.test(details)) {
            return '❌ Не найден файл cookies. Проверьте путь в настройках бота.';
        }
        if (/login|log in|sign in|cookies|private|rate.limit|429/i.test(details)) {
            return '❌ Сервис требует вход или временно ограничил доступ. Для Instagram добавьте свежие cookies через INSTAGRAM_COOKIES_FILE. Проверьте, доступен ли ролик в браузере.';
        }
        if (/ffmpeg|ffprobe/i.test(details)) {
            return '❌ Для обработки видео и аудио требуется ffmpeg. Установите его и перезапустите бота.';
        }
        if (/executable not found/i.test(details)) {
            return '❌ Не найден yt-dlp. Выполните npm install или проверьте YT_DLP_PATH.';
        }
        if (/does not contain a downloadable video/i.test(details)) {
            return '❌ В выбранной публикации Instagram нет видео для скачивания.';
        }
        let message = '❌ ';

        if (platform) {
            const config = platformConfig[platform.toLowerCase()];
            const platformName = config ? config.name : platform;
            message += `${platformName} Download Failed`;
        } else {
            message += 'Download Failed';
        }
        console.error('Error details:', error);
        return message;
    }

    static createSuccessMessage(platform, format, fileSize = null) {
        const config = platformConfig[platform.toLowerCase()];
        const platformName = config ? config.name : platform;

        let message = `✅ ${platformName} ${format} downloaded successfully!`;

        if (fileSize) {
            message += `\n📁 File size: ${this.formatFileSize(fileSize)}`;
        }

        return message;
    }

    static formatFileSize(bytes) {
        if (!bytes) return 'Unknown';

        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';

        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = UIService;
