const { platformConfig } = require('../config/platforms');
const YouTubeDownloader = require('./YouTubeDownloader');
const InstagramDownloader = require('./InstagramDownloader');
const TikTokDownloader = require('./TikTokDownloader');

const downloaders = {
    youtube: YouTubeDownloader,
    instagram: InstagramDownloader,
    tiktok: TikTokDownloader
};

function identifyPlatform(input) {
    try {
        const url = new URL(input);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return Object.keys(platformConfig).find(platform =>
            platformConfig[platform].domains.some(domain =>
                url.hostname === domain || url.hostname.endsWith(`.${domain}`)
            )
        ) || null;
    } catch {
        return null;
    }
}

function createDownloader(url) {
    const platform = identifyPlatform(url);
    if (!platform) throw new Error('Unsupported video URL');
    return new downloaders[platform](url);
}

module.exports = {
    createDownloader,
    isSupported: url => identifyPlatform(url) !== null,
    getSupportedPlatforms: () => Object.values(platformConfig).map(({ name, domains }) => ({ name, domains }))
};
