const BaseDownloader = require('./BaseDownloader');

class InstagramDownloader extends BaseDownloader {
    async getInfo() {
        try {
            // For now, using youtube-dl-exec which supports Instagram
            const youtubedl = require('youtube-dl-exec');
            const info = await youtubedl(this.url, {
                dumpSingleJson: true,
                noDownload: true
            });

            return {
                title: info.title || 'Instagram Video',
                duration: info.duration,
                uploader: info.uploader || 'Instagram User',
                platform: 'Instagram',
                thumbnail: info.thumbnail,
                description: info.description || '',
                viewCount: info.view_count,
                uploadDate: info.upload_date
            };
        } catch (error) {
            throw new Error(`Failed to get Instagram video info: ${error.message}`);
        }
    }

    async download(outputPath, options = {}) {
        const { format } = options;

        try {
            const youtubedl = require('youtube-dl-exec');

            if (format === 'audio') {
                await youtubedl(this.url, {
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: '64K',
                    output: outputPath
                });
            } else if (format === 'video') {
                // Instagram videos are typically high quality, download best available
                await youtubedl(this.url, {
                    output: outputPath,
                    format: 'best'
                });
            }
        } catch (error) {
            throw new Error(`Failed to download Instagram video: ${error.message}`);
        }
    }

    getSupportedFormats() {
        return ['audio', 'video'];
    }

    getVideoResolutions() {
        // Instagram typically provides one high-quality video
        return ['best'];
    }
}

module.exports = InstagramDownloader;