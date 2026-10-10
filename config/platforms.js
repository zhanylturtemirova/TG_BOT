const mediaDefaults = {
    supportedFormats: ['audio', 'video'],
    audioQuality: '64K',
    audioFormat: 'mp3'
};

const platformConfig = {
    youtube: {
        ...mediaDefaults,
        name: 'YouTube',
        domains: ['youtube.com', 'youtu.be'],
        videoResolutions: ['144', '240', '360', '480', '720', '1080', 'best']
    },
    instagram: {
        ...mediaDefaults,
        name: 'Instagram',
        domains: ['instagram.com'],
        videoResolutions: ['best']
    },
    tiktok: {
        ...mediaDefaults,
        name: 'TikTok',
        domains: ['tiktok.com'],
        videoResolutions: ['best']
    }
};

module.exports = { platformConfig };
