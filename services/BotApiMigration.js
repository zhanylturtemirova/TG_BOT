const { getTelegramConfig } = require('../config/telegram');

function getTargetConfig(origin) {
    if (!origin) throw new Error('Укажите адрес сервера, например http://127.0.0.1:8081.');
    const config = getTelegramConfig({ TELEGRAM_API_ROOT: origin });
    const url = new URL(config.apiRoot);
    const cloud = url.hostname === 'api.telegram.org';
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error('Для удалённого Bot API требуется HTTPS.');
    }
    if (cloud && config.apiRoot !== 'https://api.telegram.org') {
        throw new Error('Облачный адрес: https://api.telegram.org.');
    }
    return getTelegramConfig({ TELEGRAM_API_ROOT: config.apiRoot, TELEGRAM_LOCAL_MODE: String(!cloud) });
}

async function migrateBotApi({ source, target, probe, save, sameServer = false }) {
    // A reachable listener is checked before disrupting the existing connection.
    // It cannot establish whether the target has valid api_id/api_hash or --local.
    try { await probe(); } catch {
        throw new Error('Новый Bot API недоступен. Текущий сервер и .env не изменены.');
    }
    if (sameServer) {
        await target.getMe();
        await save();
        return;
    }
    let previousBot;
    try {
        previousBot = await source.getMe();
        await source.logOut();
    } catch {
        throw new Error('Не удалось выйти из прежнего Bot API. .env не изменён. Проверьте подключение и повторите.');
    }
    // Persist immediately after logout so a retry or npm start uses the new server.
    try { await save(); } catch {
        throw new Error('Выход из прежнего API выполнен, но .env не сохранён. Укажите новый TELEGRAM_API_ROOT вручную.');
    }
    try {
        const currentBot = await target.getMe();
        if (currentBot.id !== previousBot.id) throw new Error('Unexpected bot');
    } catch {
        throw new Error('Новый адрес сохранён, но авторизация не завершена. Проверьте Bot API и повторите эту команду. После выхода из облака возврат туда недоступен 10 минут.');
    }
}

module.exports = { getTargetConfig, migrateBotApi };
