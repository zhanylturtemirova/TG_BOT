const BaseDownloader = require('./BaseDownloader');

class TikTokDownloader extends BaseDownloader {
    constructor(url, dependencies) {
        super(url, 'tiktok', dependencies);
    }
}

module.exports = TikTokDownloader;
