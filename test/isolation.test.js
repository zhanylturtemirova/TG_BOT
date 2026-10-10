const { test } = require('node:test');
const assert = require('node:assert/strict');
const SelectionStore = require('../services/SelectionStore');
const { createHarness } = require('./helpers/botHarness');

const firstLink = 'https://www.instagram.com/reel/first/';
const secondLink = 'https://www.instagram.com/reel/second/';

test('two users cannot use each other’s menus', async test => {
    const app = await createHarness(test);
    await app.send(firstLink, { userId: 1, chatId: 10 });
    const firstMenu = app.menu();
    await app.send(secondLink, { userId: 2, chatId: 10 });
    const secondMenu = app.menu();
    await app.click('audio', firstMenu, { userId: 2, chatId: 10 });
    assert.equal(app.downloads.length, 0);
    await Promise.all([
        app.click('audio', firstMenu, { userId: 1, chatId: 10 }),
        app.click('audio', secondMenu, { userId: 2, chatId: 10 })
    ]);
    assert.deepEqual(app.downloads.map(download => download.url).sort(), [firstLink, secondLink]);
});

test('one user can select independently in different chats', async test => {
    const app = await createHarness(test);
    await app.send(firstLink, { chatId: 10 });
    const firstMenu = app.menu();
    await app.send(secondLink, { chatId: 20 });
    const secondMenu = app.menu();
    await app.click('audio', firstMenu, { chatId: 10 });
    await app.click('audio', secondMenu, { chatId: 20 });
    assert.deepEqual(app.requests.filter(request => request.method === 'sendAudio')
        .map(request => request.payload.chat_id), [10, 20]);
});

test('late metadata for an old link cannot replace the newer selection', async test => {
    const oldRequest = Promise.withResolvers();
    const app = await createHarness(test, { beforeInfo: url => url === firstLink ? oldRequest.promise : undefined });
    const oldLink = app.send(firstLink);
    await app.send(secondLink);
    oldRequest.resolve();
    await oldLink;
    await app.click('audio', app.menu());
    assert.equal(app.downloads[0].url, secondLink);
    assert.equal(app.requests.filter(request => request.payload.reply_markup).length, 1);
});

test('expired selections cannot start downloads', async test => {
    let now = 0;
    const selections = new SelectionStore({ ttlMs: 100, now: () => now });
    const app = await createHarness(test, { selections });
    await app.send(firstLink);
    now = 101;
    await app.click('audio', app.menu());
    assert.equal(app.downloads.length, 0);
});
