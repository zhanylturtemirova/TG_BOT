const YouTubeDownloader = require('./YouTubeDownloader');
const InstagramDownloader = require('./InstagramDownloader');
const TikTokDownloader = require('./TikTokDownloader');

class DownloaderFactory {
    static createDownloader(url) {
        const hostname = new URL(url).hostname.toLowerCase();

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return new YouTubeDownloader(url);
        } else if (hostname.includes('instagram.com')) {
            return new InstagramDownloader(url);
        } else if (hostname.includes('tiktok.com')) {
            return new TikTokDownloader(url);
        } else {
            throw new Error(`Unsupported platform: ${hostname}`);
        }
    }

    static getSupportedPlatforms() {
        return [
            { name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
            { name: 'Instagram', domains: ['instagram.com'] },
            { name: 'TikTok', domains: ['tiktok.com'] }
            // Add more platforms here in the future
        ];
    }

    static isSupported(url) {
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            return this.getSupportedPlatforms().some(platform =>
                platform.domains.some(domain => hostname.includes(domain))
            );
        } catch {
            return false;
        }
    }
}

module.exports = DownloaderFactory;