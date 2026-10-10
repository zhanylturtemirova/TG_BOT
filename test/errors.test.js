const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createHarness } = require('./helpers/botHarness');
const factory = require('../downloaders/DownloaderFactory');
const { retry } = require('../utils/retry');

const instagram = 'https://www.instagram.com/reel/example/';

test('metadata failure reports an actionable message without exposing extractor diagnostics', async test => {
    const app = await createHarness(test, { beforeInfo() { throw new Error('Login required; PRIVATE_SESSION_DETAIL'); } });
    await app.send(instagram);
    const response = app.requests.at(-1).payload.text;
    assert.match(response, /вход/);
    assert.doesNotMatch(response, /PRIVATE_SESSION_DETAIL/);
    assert.equal(app.menu(), undefined);
});

test('download failure cleans up partial media before notifying the user', async test => {
    const app = await createHarness(test, { downloadError: new Error('Requested format is not available') });
    await app.send(instagram);
    await app.click('video_best', app.menu());
    assert.deepEqual(await fs.readdir(app.tempDir), []);
    assert.equal(app.requests.some(request => request.method === 'sendVideo'), false);
    assert.ok(app.requests.some(request => request.payload.text?.includes('качество недоступно')));
});

test('a failed message deletion does not prevent cleanup of the remaining messages', async test => {
    let deletionAttempts = 0;
    const app = await createHarness(test, { beforeApi(method) {
        if (method === 'deleteMessage' && ++deletionAttempts === 1) throw new Error('message already deleted');
    } });
    await app.send(instagram);
    await app.click('delete_message', app.menu());
    assert.equal(deletionAttempts, 2);
    assert.equal(app.downloads.length, 0);
});

test('queue command reports no invented position for a user without a job', async test => {
    const app = await createHarness(test);
    await app.send('/queue');
    assert.match(app.requests.at(-1).payload.text, /нет загрузок/);
    assert.doesNotMatch(app.requests.at(-1).payload.text, /Ваше место/);
});

test('factory accepts supported hostnames and subdomains, rejects lookalikes and non-HTTP URLs', () => {
    for (const url of ['https://youtu.be/example', 'https://m.youtube.com/watch?v=x',
        'https://instagram.com/reel/x', 'https://vm.tiktok.com/example']) {
        assert.ok(factory.isSupported(url), url);
        assert.ok(factory.createDownloader(url).platform);
    }
    for (const url of ['https://notyoutube.com', 'https://youtube.com.evil.test',
        'ftp://youtube.com/x', 'https://user:pass@instagram.com/x', 'not a URL']) {
        assert.equal(factory.isSupported(url), false, url);
        assert.throws(() => factory.createDownloader(url), /Unsupported/);
    }
});

test('persistent transient errors stop after the configured number of attempts', async () => {
    let attempts = 0;
    await assert.rejects(retry(async () => {
        attempts++;
        throw new Error('network timeout');
    }, { attempts: 3, wait: async () => {} }), /network timeout/);
    assert.equal(attempts, 3);
});
