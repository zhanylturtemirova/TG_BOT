const fs = require('node:fs/promises');
const path = require('node:path');
const { platformConfig } = require('../config/platforms');
const { getTelegramConfig } = require('../config/telegram');

class DownloadService {
    constructor(telegram = getTelegramConfig(), { tempDir = path.resolve(__dirname, '../temp') } = {}) {
        this.tempDir = tempDir;
        this.telegram = telegram;
        this.activeDownloads = new Map();
    }

    async downloadContent(downloader, format, resolution = null, userId) {
        const platform = downloader.platform;
        const config = platformConfig[platform];
        if (!config || !config.supportedFormats.includes(format)) {
            throw new Error(`Unsupported download format: ${format}`);
        }
        resolution ||= 'best';
        if (format === 'video' && !config.videoResolutions.includes(resolution)) {
            throw new Error(`Unsupported resolution: ${resolution}`);
        }

        const tempDir = this.tempDir;
        await fs.mkdir(tempDir, { recursive: true });
        const workDir = await fs.mkdtemp(path.join(tempDir, `${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}_`));
        const downloadId = path.basename(workDir);
        this.activeDownloads.set(downloadId, { workDir, status: 'processing', startTime: Date.now() });
        try {
            const extension = format === 'audio' ? config.audioFormat : 'mp4';
            const outputPath = path.join(workDir, `output.${extension}`);
            await downloader.download(outputPath, { format, resolution });

            // Ignore intermediate .f123.mp4 streams and unfinished .part downloads.
            const files = (await fs.readdir(workDir)).filter(file => /^output\.(mp3|mp4|webm|m4a|mkv)$/.test(file));
            const actualFile = files.includes(`output.${extension}`) ? `output.${extension}` : files[0];
            if (!actualFile) throw new Error('Downloaded file not found');
            const filePath = path.join(workDir, actualFile);
            const { size } = await fs.stat(filePath);
            if (!size) throw new Error('Downloaded file is empty');
            if (size > this.telegram.maxFileSize) {
                const error = new Error(this.telegram.local
                    ? 'Файл больше 2000 МБ — лимита локального Telegram Bot API. Выберите качество ниже или только аудио.'
                    : 'Файл больше 50 МБ — лимита обычного Telegram Bot API. Выберите качество ниже или только аудио. Для отправки одним файлом до 2000 МБ нужен локальный сервер Bot API.');
                error.code = 'FILE_TOO_LARGE';
                throw error;
            }

            this.activeDownloads.set(downloadId, {
                ...this.activeDownloads.get(downloadId), status: 'sending', filePath, fileSize: size
            });
            return { downloadId, filePath, fileSize: size, needsSplit: false };
        } catch (error) {
            await this.cleanup(downloadId);
            throw error;
        }
    }

    async cleanup(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (!download) return;
        await fs.rm(download.workDir, { recursive: true, force: true });
        this.activeDownloads.delete(downloadId);
    }

    getActiveDownloads(userId) {
        return [...this.activeDownloads.entries()]
            .filter(([key]) => key.startsWith(`${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}_`))
            .map(([id, value]) => ({ id, ...value }));
    }
}

module.exports = { DownloadService };
