function getTelegramConfig(env = process.env) {
    const apiRoot = (env.TELEGRAM_API_ROOT || 'https://api.telegram.org').replace(/\/+$/, '');
    const url = new URL(apiRoot);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/') {
        throw new Error('TELEGRAM_API_ROOT must be an HTTP(S) server origin, without a token or path.');
    }
    const local = env.TELEGRAM_LOCAL_MODE === 'true';
    if (local && url.hostname === 'api.telegram.org') {
        throw new Error('TELEGRAM_LOCAL_MODE requires your own Bot API server running with --local.');
    }
    return {
        apiRoot,
        local,
        // Conservative decimal limits: do not exceed the documented MB limits.
        maxFileSize: (local ? 2000 : 50) * 1000 * 1000,
        timeoutSeconds: local ? 1800 : 300
    };
}

module.exports = { getTelegramConfig };
