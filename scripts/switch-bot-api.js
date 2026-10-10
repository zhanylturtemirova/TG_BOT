const fs = require('node:fs/promises');
const path = require('node:path');
const dotenv = require('dotenv');
const { Api } = require('grammy');
const { projectRoot } = require('../config/localBotApi');
const { getTelegramConfig } = require('../config/telegram');
const { getTargetConfig, migrateBotApi } = require('../services/BotApiMigration');
const { updateEnvFile } = require('../utils/updateEnvFile');

async function main() {
    const target = getTargetConfig(process.argv[2]);
    const envPath = path.join(projectRoot, '.env');
    const contents = await fs.readFile(envPath, 'utf8');
    const env = dotenv.parse(contents);
    if (!env.BOT_API_KEY) throw new Error('Добавьте BOT_API_KEY в .env.');
    const source = getTelegramConfig(env);
    const api = apiRoot => new Api(env.BOT_API_KEY, { apiRoot, timeoutSeconds: 60 });
    console.log('Другие процессы бота должны быть остановлены перед переносом.');
    await migrateBotApi({
        source: api(source.apiRoot), target: api(target.apiRoot),
        sameServer: source.apiRoot === target.apiRoot,
        probe: async () => {
            const response = await fetch(target.apiRoot, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
            await response.body?.cancel();
            if (response.status >= 500) throw new Error('Server unavailable');
        },
        save: () => updateEnvFile(envPath, {
            TELEGRAM_API_ROOT: target.apiRoot, TELEGRAM_LOCAL_MODE: target.local
        })
    });
    console.log(`Подключение проверено. Лимит: ${target.maxFileSize / 1_000_000} МБ. Теперь выполните npm start.`);
}

main().catch(error => {
    // grammY errors can contain the request URL/token; expose only our own errors.
    console.error(error.constructor === Error ? error.message : 'Не удалось переключить Bot API. Проверьте настройки.');
    process.exitCode = 1;
});
