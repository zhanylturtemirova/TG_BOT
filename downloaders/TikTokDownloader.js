const BaseDownloader = require('./BaseDownloader');

class TikTokDownloader extends BaseDownloader {
    async getInfo() {
        try {
            // For now, using youtube-dl-exec which supports TikTok
            const youtubedl = require('youtube-dl-exec');
            const info = await youtubedl(this.url, {
                dumpSingleJson: true,
                noDownload: true
            });

            return {
                title: info.title || 'TikTok Video',
                duration: info.duration,
                uploader: info.uploader || 'TikTok User',
                platform: 'TikTok',
                thumbnail: info.thumbnail,
                description: info.description || '',
                viewCount: info.view_count,
                uploadDate: info.upload_date
            };
        } catch (error) {
            throw new Error(`Failed to get TikTok video info: ${error.message}`);
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
                // TikTok videos are typically high quality, download best available
                await youtubedl(this.url, {
                    output: outputPath,
                    format: 'best'
                });
            }
        } catch (error) {
            throw new Error(`Failed to download TikTok video: ${error.message}`);
        }
    }

    getSupportedFormats() {
        return ['audio', 'video'];
    }

    getVideoResolutions() {
        // TikTok typically provides one high-quality video
        return ['best'];
    }
}

module.exports = TikTokDownloader;