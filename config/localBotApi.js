const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function getLocalServerConfig(env = process.env) {
    if (!/^[1-9]\d*$/.test(env.TELEGRAM_API_ID || '') ||
        !/^[a-f\d]{32}$/i.test(env.TELEGRAM_API_HASH || '')) {
        throw new Error('Добавьте TELEGRAM_API_ID и TELEGRAM_API_HASH с my.telegram.org в .env.');
    }
    const port = Number(env.BOT_API_PORT || 8081);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error('BOT_API_PORT должен быть целым числом от 1024 до 65535.');
    }
    return {
        executable: env.BOT_API_EXECUTABLE || path.join(projectRoot, '.local/bin/telegram-bot-api'),
        directory: path.join(projectRoot, '.local/bot-api-data'),
        port,
        // Credentials go through the child environment, never command-line arguments.
        credentials: { TELEGRAM_API_ID: env.TELEGRAM_API_ID, TELEGRAM_API_HASH: env.TELEGRAM_API_HASH }
    };
}

module.exports = { getLocalServerConfig, projectRoot };
