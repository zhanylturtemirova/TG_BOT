const BaseDownloader = require('./BaseDownloader');

class TikTokDownloader extends BaseDownloader {
    async getInfo() {
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to get TikTok info (attempt ${attempt}/${maxRetries})`);

                // For now, using youtube-dl-exec which supports TikTok
                const youtubedl = require('youtube-dl-exec');
                const info = await youtubedl(this.url, {
                    dumpSingleJson: true,
                    noDownload: true,
                    addHeader: [
                        'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    ],
                    forceIpv4: true,
                    retrySleep: 2,
                    sleepInterval: 1,
                    maxSleepInterval: 5
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
                lastError = error;
                console.log(`TikTok info attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    console.log(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        throw new Error(`Failed to get TikTok video info after ${maxRetries} attempts: ${lastError.message}`);
    }

    async download(outputPath, options = {}) {
        const { format } = options;
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to download TikTok content (attempt ${attempt}/${maxRetries})`);

                const youtubedl = require('youtube-dl-exec');

                if (format === 'audio') {
                    await youtubedl(this.url, {
                        extractAudio: true,
                        audioFormat: 'mp3',
                        audioQuality: '64K',
                        output: outputPath,
                        addHeader: [
                            'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        ],
                        forceIpv4: true,
                        retrySleep: 2,
                        sleepInterval: 1,
                        maxSleepInterval: 5
                    });
                } else if (format === 'video') {
                    // TikTok videos are typically high quality, download best available
                    await youtubedl(this.url, {
                        output: outputPath,
                        format: 'best[ext=mp4]/best',
                        mergeOutputFormat: 'mp4',
                        addHeader: [
                            'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        ],
                        forceIpv4: true,
                        retrySleep: 2,
                        sleepInterval: 1,
                        maxSleepInterval: 5
                    });
                }

                return;

            } catch (error) {
                lastError = error;
                console.log(`TikTok download attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
                    console.log(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        throw new Error(`Failed to download TikTok video after ${maxRetries} attempts: ${lastError.message}`);
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