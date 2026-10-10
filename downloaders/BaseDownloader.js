const runYtDlp = require('../services/YtDlp');
const { cookieOptions } = require('../services/YtDlp');
const { platformConfig } = require('../config/platforms');
const { retry } = require('../utils/retry');

class BaseDownloader {
    constructor(url, platform, { run = runYtDlp, withRetry = retry } = {}) {
        this.url = url;
        this.platform = platform;
        this.config = platformConfig[platform];
        this.run = run;
        this.withRetry = withRetry;
    }

    getOptions() {
        return {
            noPlaylist: true,
            forceIpv4: true,
            ...(this.platform === 'tiktok' ? {} : cookieOptions(this.platform))
        };
    }

    async getInfo() {
        const extracted = await this.execute({ dumpSingleJson: true, skipDownload: true });
        const media = extracted.entries ? extracted.entries.find(Boolean) : extracted;
        if (!media || (!media.url && !media.formats?.length)) {
            throw new Error('The selected post does not contain a downloadable video.');
        }
        return {
            title: media.title || `${this.config.name} Video`,
            duration: media.duration,
            uploader: media.uploader || this.config.name,
            platform: this.config.name,
            thumbnail: media.thumbnail
        };
    }

    async download(outputPath, { format, resolution = 'best' }) {
        if (!this.config.supportedFormats.includes(format)) {
            throw new Error(`Unsupported download format: ${format}`);
        }
        const mediaOptions = format === 'audio'
            ? {
                extractAudio: true,
                audioFormat: this.config.audioFormat,
                audioQuality: this.config.audioQuality
            }
            : this.getVideoOptions(resolution);
        await this.execute({ output: outputPath, ...mediaOptions });
    }

    getVideoOptions() {
        return { format: 'best[ext=mp4]/best', mergeOutputFormat: 'mp4' };
    }

    execute(options) {
        return this.withRetry(() => this.run(this.url, { ...this.getOptions(), ...options }));
    }
}

module.exports = BaseDownloader;
