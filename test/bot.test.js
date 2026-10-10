const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createHarness } = require('./helpers/botHarness');

const instagram = 'https://www.instagram.com/reel/DdOyq0Vxhs6/';
const youtube = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test('YouTube link → quality menu → file upload → temporary files removed', async test => {
    const app = await createHarness(test, { beforeApi: async method => {
        if (method === 'sendVideo') {
            assert.equal(await fs.readFile(app.downloads[0].flags.output, 'utf8'), 'fixture media bytes');
        }
    } });
    await app.send(youtube);
    const buttons = app.requests.findLast(request => request.payload.reply_markup)
        .payload.reply_markup.inline_keyboard.flat();
    assert.ok(buttons.some(button => button.callback_data === 'video_360'));
    assert.ok(buttons.some(button => button.callback_data === 'audio'));
    await app.click('video_360', app.menu());
    assert.equal(app.downloads.length, 1);
    assert.ok(app.downloads[0].flags.format.split('/').every(format => format.includes('[height<=360]')));
    const uploads = app.requests.filter(request => request.method === 'sendVideo');
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].payload.supports_streaming, true);
    assert.equal(uploads[0].payload.chat_id, 1);
    assert.deepEqual(await fs.readdir(app.tempDir), []);
});

test('Instagram link → audio produces MP3 and uses sendAudio', async test => {
    const app = await createHarness(test);
    await app.send(instagram);
    await app.click('audio', app.menu());
    assert.equal(app.downloads[0].flags.audioFormat, 'mp3');
    assert.equal(app.downloads[0].flags.extractAudio, true);
    const audio = app.requests.find(request => request.method === 'sendAudio');
    assert.ok(audio.payload.audio.filename.endsWith('.mp3'));
    assert.equal(app.requests.some(request => request.method === 'sendVideo'), false);
    assert.deepEqual(await fs.readdir(app.tempDir), []);
});

test('cancel consumes the menu without downloading; stale clicks cannot restart it', async test => {
    const app = await createHarness(test);
    await app.send(instagram);
    const menu = app.menu();
    await app.click('cancel', menu);
    await app.click('video_best', menu);
    assert.equal(app.downloads.length, 0);
    assert.match(app.requests.at(-1).payload.text, /устарело/);
});

test('concurrent double click starts exactly one download', async test => {
    const app = await createHarness(test);
    await app.send(instagram);
    const menu = app.menu();
    await Promise.all([app.click('video_best', menu), app.click('video_best', menu)]);
    assert.equal(app.downloads.length, 1);
    assert.equal(app.requests.filter(request => request.method === 'sendVideo').length, 1);
});

test('unknown choices do not consume the valid menu', async test => {
    const app = await createHarness(test);
    await app.send(youtube);
    const menu = app.menu();
    await app.click('video_9999', menu);
    await app.click('audio', menu);
    assert.equal(app.downloads.length, 1);
    assert.equal(app.downloads[0].flags.extractAudio, true);
});

test('upload failure still removes downloaded files and reports a useful error', async test => {
    const app = await createHarness(test, { failMethod: 'sendVideo' });
    await app.send(instagram);
    await app.click('video_best', app.menu());
    assert.deepEqual(await fs.readdir(app.tempDir), []);
    assert.ok(app.requests.some(request => request.payload.text?.includes('Не удалось')));
});

test('deleted progress messages do not prevent sending media', async test => {
    const app = await createHarness(test, { failMethod: 'editMessageText' });
    await app.send(instagram);
    await app.click('video_best', app.menu());
    assert.equal(app.requests.filter(request => request.method === 'sendVideo').length, 1);
});

test('oversized file is not uploaded, the retry menu works, and old files are removed', async test => {
    const app = await createHarness(test, { size: flags => flags.extractAudio ? 100 : 50_000_001 });
    await app.send(youtube);
    const originalMenu = app.menu();
    await app.click('video_720', originalMenu);
    assert.equal(app.requests.some(request => request.method === 'sendVideo'), false);
    assert.notEqual(app.menu(), originalMenu);
    assert.deepEqual(await fs.readdir(app.tempDir), []);
    await app.click('audio', app.menu());
    assert.equal(app.downloads.length, 2);
    assert.equal(app.requests.filter(request => request.method === 'sendAudio').length, 1);
    assert.deepEqual(await fs.readdir(app.tempDir), []);
});

test('a hidden text link after an emoji is supported', async test => {
    const app = await createHarness(test);
    await app.send('🎥 открыть', { entities: [{ type: 'text_link', offset: 3, length: 7, url: instagram }] });
    assert.ok(app.menu());
});

test('unsupported domains are rejected before starting a media process', async test => {
    const app = await createHarness(test);
    await app.send('https://instagram.com.evil.example/reel/test/');
    assert.equal(app.menu(), undefined);
    assert.equal(app.downloads.length, 0);
});

test('start does not expose an unset donation link', async test => {
    const app = await createHarness(test);
    await app.send('/start');
    assert.doesNotMatch(app.requests.at(-1).payload.text, /undefined/);
});
