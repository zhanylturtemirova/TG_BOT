const BaseDownloader = require('./BaseDownloader');

class YouTubeDownloader extends BaseDownloader {
    constructor(url, dependencies) {
        super(url, 'youtube', dependencies);
    }

    getOptions() {
        return { ...super.getOptions(), jsRuntimes: `node:${process.execPath}` };
    }

    getVideoOptions(resolution) {
        if (!this.config.videoResolutions.includes(resolution)) {
            throw new Error(`Unsupported resolution: ${resolution}`);
        }
        const heightLimit = resolution === 'best' ? '' : `[height<=${resolution}]`;
        return {
            format: `bestvideo${heightLimit}[ext=mp4]+bestaudio[ext=m4a]/best${heightLimit}[ext=mp4]`,
            mergeOutputFormat: 'mp4',
            formatSort: 'vcodec:h264,acodec:aac'
        };
    }
}

module.exports = YouTubeDownloader;
