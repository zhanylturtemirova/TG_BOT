const youtubedl = require('youtube-dl-exec');
const BaseDownloader = require('./BaseDownloader');

class YouTubeDownloader extends BaseDownloader {
    async getInfo() {
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to get YouTube info (attempt ${attempt}/${maxRetries})`);

                const info = await youtubedl(this.url, {
                    dumpSingleJson: true,
                    noDownload: true,
                    // Add headers to appear more like a real browser
                    addHeader: [
                        'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language:en-US,en;q=0.9'
                    ],
                    // Use cookies if available (you can add a cookies.txt file)
                    cookies: './cookies.txt', // Optional: create this file with YouTube cookies
                    // Force IPv4 to avoid some connectivity issues
                    forceIpv4: true,
                    // Add retry and timeout options
                    retrySleep: 2,
                    sleepInterval: 1,
                    maxSleepInterval: 5,
                    // Use geo-bypass if needed
                    geoBypass: true,
                    // Try to use Node.js as JS runtime if available
                    jsRuntime: 'node'
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
                lastError = error;
                console.log(`YouTube info attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    // Exponential backoff: wait longer between retries
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    console.log(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        throw new Error(`Failed to get YouTube video info after ${maxRetries} attempts: ${lastError.message}`);
    }

    async download(outputPath, options = {}) {
        const { format, resolution } = options;
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to download YouTube content (attempt ${attempt}/${maxRetries})`);

                if (format === 'audio') {
                    await youtubedl(this.url, {
                        extractAudio: true,
                        audioFormat: 'mp3',
                        audioQuality: '64K',
                        output: outputPath,
                        // Add same headers and options as getInfo
                        addHeader: [
                            'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        ],
                        cookies: './cookies.txt',
                        forceIpv4: true,
                        retrySleep: 2,
                        sleepInterval: 1,
                        maxSleepInterval: 5,
                        geoBypass: true,
                        jsRuntime: 'node'
                    });
                } else if (format === 'video') {
                    await youtubedl(this.url, {
                        output: outputPath,
                        format: `bestvideo[height<=${resolution}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${resolution}][ext=mp4]/best[ext=mp4]`,
                        // Merge to MP4 format
                        mergeOutputFormat: 'mp4',
                        // Add same headers and options as getInfo
                        addHeader: [
                            'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        ],
                        cookies: './cookies.txt',
                        forceIpv4: true,
                        retrySleep: 2,
                        sleepInterval: 1,
                        maxSleepInterval: 5,
                        geoBypass: true,
                        jsRuntime: 'node'
                    });
                }

                return; // Success, exit the retry loop

            } catch (error) {
                lastError = error;
                console.log(`YouTube download attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    // Exponential backoff: wait longer between retries
                    const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
                    console.log(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        throw new Error(`Failed to download YouTube video after ${maxRetries} attempts: ${lastError.message}`);
    }

    getSupportedFormats() {
        return ['audio', 'video'];
    }

    getVideoResolutions() {
        return ['144', '260', '360', '480', '720', '1080'];
    }
}

module.exports = YouTubeDownloader;