const youtubedl = require('youtube-dl-exec');
const BaseDownloader = require('./BaseDownloader');

class YouTubeDownloader extends BaseDownloader {
    async getInfo() {
        try {
            const info = await youtubedl(this.url, {
                dumpSingleJson: true,
                noDownload: true
            });

            return {
                title: info.title,
                duration: info.duration,
                uploader: info.uploader,
                platform: 'YouTube',
                thumbnail: info.thumbnail,
                description: info.description,
                viewCount: info.view_count,
                uploadDate: info.upload_date
            };
        } catch (error) {
            throw new Error(`Failed to get YouTube video info: ${error.message}`);
        }
    }

    async download(outputPath, options = {}) {
        const { format, resolution } = options;

        try {
            if (format === 'audio') {
                await youtubedl(this.url, {
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: '64K',
                    output: outputPath
                });
            } else if (format === 'video') {
                await youtubedl(this.url, {
                    output: outputPath,
                    format: `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`
                });
            }
        } catch (error) {
            throw new Error(`Failed to download YouTube video: ${error.message}`);
        }
    }

    getSupportedFormats() {
        return ['audio', 'video'];
    }

    getVideoResolutions() {
        return ['144', '260', '360', '480', '720', '1080'];
    }
}

module.exports = YouTubeDownloader;