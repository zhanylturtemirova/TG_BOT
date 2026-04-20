// Configuration for different platforms and their capabilities
const platformConfig = {
    youtube: {
        name: 'YouTube',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        supportedFormats: ['audio', 'video'],
        videoResolutions: ['144', '260', '360', '480', '720', '1080'],
        audioQuality: '64K',
        audioFormat: 'mp3'
    },
    instagram: {
        name: 'Instagram',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        supportedFormats: ['audio', 'video'],
        videoResolutions: ['best'], // Instagram provides one high-quality video
        audioQuality: '64K',
        audioFormat: 'mp3'
    },
    tiktok: {
        name: 'TikTok',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        supportedFormats: ['audio', 'video'],
        videoResolutions: ['best'], // TikTok provides one video quality
        audioQuality: '64K',
        audioFormat: 'mp3'
    }
    // Add more platforms here as they are implemented
};

// Global bot configuration
const botConfig = {
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    tempDir: './temp',
    cleanupInterval: 3600000, // 1 hour
    rateLimit: {
        windowMs: 60000, // 1 minute
        maxRequests: 10 // 10 requests per minute per user
    }
};

module.exports = {
    platformConfig,
    botConfig
};