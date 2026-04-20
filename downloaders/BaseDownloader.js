const fs = require('fs');
const path = require('path');

// Common interface for all downloaders
class BaseDownloader {
    constructor(url) {
        this.url = url;
    }

    // Abstract methods to be implemented by subclasses
    async getInfo() {
        throw new Error('getInfo() must be implemented');
    }

    async download(outputPath, options = {}) {
        throw new Error('download() must be implemented');
    }

    getSupportedFormats() {
        return ['audio', 'video'];
    }

    getVideoResolutions() {
        return ['144', '260', '360', '480', '720', '1080'];
    }
}

module.exports = BaseDownloader;