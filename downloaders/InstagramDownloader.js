const BaseDownloader = require('./BaseDownloader');

class InstagramDownloader extends BaseDownloader {
    constructor(url, dependencies) {
        super(url, 'instagram', dependencies);
    }

    getOptions() {
        // A carousel must not overwrite several videos into the same output file.
        return { ...super.getOptions(), playlistItems: '1' };
    }
}

module.exports = InstagramDownloader;
