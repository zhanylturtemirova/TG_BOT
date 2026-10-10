const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { getLocalServerConfig, projectRoot } = require('../config/localBotApi');

require('dotenv').config({ path: path.join(projectRoot, '.env'), quiet: true });

async function main() {
    const config = getLocalServerConfig();
    await fs.access(config.executable, fs.constants.X_OK).catch(() => {
        throw new Error('Telegram Bot API не установлен. См. docs/LOCAL_BOT_API.md.');
    });
    await fs.mkdir(config.directory, { recursive: true, mode: 0o700 });
    console.log(`Запуск Bot API: http://127.0.0.1:${config.port} (до 2000 МБ).`);
    const server = spawn(config.executable, [
        '--local', '--http-ip-address=127.0.0.1', `--http-port=${config.port}`,
        `--dir=${config.directory}`, '--verbosity=0'
    ], { env: { ...process.env, ...config.credentials }, stdio: 'inherit' });
    const handlers = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, () => server.kill(signal)]));
    for (const [signal, handler] of handlers) process.on(signal, handler);
    server.once('error', () => {
        console.error('Не удалось запустить процесс Bot API.');
        process.exitCode = 1;
    });
    server.once('close', code => {
        for (const [signal, handler] of handlers) process.off(signal, handler);
        process.exitCode = code ?? 0;
    });
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
