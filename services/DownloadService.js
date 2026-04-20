const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { platformConfig, botConfig } = require('../config/platforms');

class DownloadService {
    constructor() {
        this.activeDownloads = new Map();
    }

    async downloadContent(downloader, format, resolution = null, userId) {
        const downloadId = `${userId}_${Date.now()}`;
        this.activeDownloads.set(downloadId, { status: 'processing', startTime: Date.now() });

        try {
            // Get platform config
            const platform = downloader.constructor.name.toLowerCase().replace('downloader', '');
            const config = platformConfig[platform];

            if (!config) {
                throw new Error(`Configuration not found for platform: ${platform}`);
            }

            // Validate format
            if (!config.supportedFormats.includes(format)) {
                throw new Error(`Format ${format} not supported for ${config.name}`);
            }

            // Validate resolution for video
            if (format === 'video' && resolution && !config.videoResolutions.includes(resolution)) {
                throw new Error(`Resolution ${resolution}p not supported for ${config.name}`);
            }

            // Create output path
            const extension = format === 'audio' ? config.audioFormat : 'mp4';
            const outputPath = path.join(__dirname, `../temp/output_${downloadId}.${extension}`);

            // Ensure temp directory exists
            await fs.mkdir(path.dirname(outputPath), { recursive: true });

            // Download the content
            await downloader.download(outputPath, { format, resolution });

            // Verify file exists and has content
            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
                throw new Error('Downloaded file is empty');
            }

            // Check file size limit
            if (stats.size > config.maxFileSize) {
                // Handle large files (split into parts)
                return await this.handleLargeFile(outputPath, downloader, config, format);
            }

            this.activeDownloads.set(downloadId, {
                status: 'completed',
                filePath: outputPath,
                fileSize: stats.size,
                endTime: Date.now()
            });

            return {
                filePath: outputPath,
                fileSize: stats.size,
                needsSplit: false
            };

        } catch (error) {
            this.activeDownloads.set(downloadId, {
                status: 'failed',
                error: error.message,
                endTime: Date.now()
            });
            throw error;
        }
    }

    async handleLargeFile(outputPath, downloader, config, format) {
        try {
            const stats = await fs.stat(outputPath);
            const maxSize = 45 * 1024 * 1024; // 45MB per part
            const numParts = Math.ceil(stats.size / maxSize);

            // Get video info for duration (if available)
            let duration = 0;
            try {
                const info = await downloader.getInfo();
                duration = info.duration || 0;
            } catch (e) {
                console.log('Could not get duration for splitting:', e.message);
            }

            const segmentTime = duration > 0 ? Math.floor(duration / numParts) : 30; // Default 30s segments
            const baseName = path.basename(outputPath, path.extname(outputPath));
            const ext = path.extname(outputPath);
            const segmentPattern = path.join(path.dirname(outputPath), `${baseName}_%03d${ext}`);

            // Split the file using ffmpeg
            execSync(`ffmpeg -i "${outputPath}" -f segment -segment_time ${segmentTime} -c copy "${segmentPattern}"`);

            // Get all parts
            const dir = path.dirname(outputPath);
            const parts = (await fs.readdir(dir))
                .filter(f => f.startsWith(baseName + '_') && f.endsWith(ext))
                .sort()
                .map(f => path.join(dir, f));

            // Clean up original file
            await fs.unlink(outputPath);

            return {
                filePaths: parts,
                needsSplit: true,
                totalParts: parts.length
            };

        } catch (error) {
            throw new Error(`Failed to split large file: ${error.message}`);
        }
    }

    async cleanup(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (download && download.filePath) {
            try {
                if (Array.isArray(download.filePath)) {
                    // Multiple files (split parts)
                    for (const filePath of download.filePath) {
                        await fs.unlink(filePath);
                    }
                } else {
                    // Single file
                    await fs.unlink(download.filePath);
                }
            } catch (error) {
                console.log(`Failed to cleanup files for ${downloadId}:`, error.message);
            }
        }
        this.activeDownloads.delete(downloadId);
    }

    getActiveDownloads(userId) {
        return Array.from(this.activeDownloads.entries())
            .filter(([key]) => key.startsWith(`${userId}_`))
            .map(([key, value]) => ({ id: key, ...value }));
    }

    // Periodic cleanup of old downloads
    async periodicCleanup() {
        const now = Date.now();
        const maxAge = botConfig.cleanupInterval; // 1 hour

        for (const [downloadId, download] of this.activeDownloads.entries()) {
            if (now - download.startTime > maxAge) {
                await this.cleanup(downloadId);
            }
        }
    }
}

module.exports = new DownloadService();