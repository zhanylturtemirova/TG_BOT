const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');
const { getLocalServerConfig } = require('../config/localBotApi');
const { getTargetConfig, migrateBotApi } = require('../services/BotApiMigration');
const { updateEnvFile } = require('../utils/updateEnvFile');

function migration(failure) {
    const calls = [];
    const operation = name => async () => {
        calls.push(name);
        if (name === failure) throw new Error('secret transport diagnostic');
        return { id: 123 };
    };
    return { calls, options: {
        source: { getMe: operation('source.getMe'), logOut: operation('source.logOut') },
        target: { getMe: operation('target.getMe') },
        probe: operation('probe'), save: operation('save')
    } };
}

test('local server validates credentials and port without including secrets in errors', () => {
    const env = { TELEGRAM_API_ID: '123', TELEGRAM_API_HASH: 'a'.repeat(32) };
    const config = getLocalServerConfig(env);
    assert.equal(config.port, 8081);
    assert.equal(config.credentials.TELEGRAM_API_HASH, env.TELEGRAM_API_HASH);
    assert.throws(() => getLocalServerConfig({}), /TELEGRAM_API_ID/);
    assert.throws(() => getLocalServerConfig({ ...env, BOT_API_PORT: '80' }), /BOT_API_PORT/);
});

test('migration supports loopback, remote HTTPS and return to cloud', () => {
    assert.equal(getTargetConfig('http://127.0.0.1:8081/').maxFileSize, 2_000_000_000);
    assert.equal(getTargetConfig('https://bot-api.example.com').local, true);
    assert.equal(getTargetConfig('https://api.telegram.org').local, false);
    for (const origin of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/token', 'http://api.telegram.org']) {
        assert.throws(() => getTargetConfig(origin));
    }
});

test('migration probes before logout, saves target, then verifies bot identity', async () => {
    const { options, calls } = migration();
    await migrateBotApi(options);
    assert.deepEqual(calls, ['probe', 'source.getMe', 'source.logOut', 'save', 'target.getMe']);
});

test('unreachable target does not log out or change settings', async () => {
    const { options, calls } = migration('probe');
    await assert.rejects(migrateBotApi(options), /Текущий сервер и .env не изменены/);
    assert.deepEqual(calls, ['probe']);
});

test('logout failure keeps the old configuration and hides transport diagnostics', async () => {
    const { options, calls } = migration('source.logOut');
    await assert.rejects(migrateBotApi(options), error => {
        assert.match(error.message, /.env не изменён/);
        assert.ok(!error.message.includes('secret'));
        return true;
    });
    assert.ok(!calls.includes('save'));
});

test('authorization failure after logout retains target settings for a safe retry', async () => {
    const { options, calls } = migration('target.getMe');
    await assert.rejects(migrateBotApi(options), /Новый адрес сохранён/);
    assert.ok(calls.indexOf('save') < calls.indexOf('target.getMe'));
    const retry = migration();
    await migrateBotApi({ ...retry.options, sameServer: true });
    assert.deepEqual(retry.calls, ['probe', 'target.getMe', 'save']);
});

test('save failure after logout reports the recovery step', async () => {
    const { options, calls } = migration('save');
    await assert.rejects(migrateBotApi(options), /Укажите новый TELEGRAM_API_ROOT вручную/);
    assert.ok(!calls.includes('target.getMe'));
});

test('environment update preserves token and comments, replaces duplicate settings, restricts permissions', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bot api env '));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, '.env');
    await fs.writeFile(file, '# keep comment\nBOT_API_KEY=test-token\nTELEGRAM_API_ROOT=old\nexport TELEGRAM_API_ROOT=duplicate\n');
    await updateEnvFile(file, { TELEGRAM_API_ROOT: 'http://127.0.0.1:8081', TELEGRAM_LOCAL_MODE: true });
    const content = await fs.readFile(file, 'utf8');
    assert.match(content, /# keep comment/);
    assert.equal(dotenv.parse(content).BOT_API_KEY, 'test-token');
    assert.equal(dotenv.parse(content).TELEGRAM_LOCAL_MODE, 'true');
    assert.equal(content.match(/TELEGRAM_API_ROOT=/g).length, 1);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await fs.readdir(dir), ['.env']);
});
