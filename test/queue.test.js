const { test } = require('node:test');
const assert = require('node:assert/strict');
const DownloadQueue = require('../services/DownloadQueue');
const { retry } = require('../utils/retry');

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('queue limits concurrency, starts waiting jobs in order and tracks the real owner', async () => {
    const queue = new DownloadQueue(2);
    const gates = Array.from({ length: 4 }, () => Promise.withResolvers());
    const started = [];
    let active = 0;
    let peak = 0;
    const jobs = gates.map((gate, index) => queue.addJob(async () => {
        started.push(index);
        peak = Math.max(peak, ++active);
        await gate.promise;
        active--;
        return index;
    }, `user-${index}`));
    assert.deepEqual(started, [0, 1]);
    assert.equal(queue.getStatus('user-2').position, 1);
    assert.equal(queue.getStatus('user-3').position, 2);
    assert.equal(queue.getStatus('nobody').position, 0);
    assert.equal(queue.getStatus('user-0').userActive, true);
    gates[0].resolve();
    await nextTurn();
    assert.deepEqual(started, [0, 1, 2]);
    gates[1].resolve();
    await nextTurn();
    assert.deepEqual(started, [0, 1, 2, 3]);
    gates[2].resolve();
    gates[3].resolve();
    assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3]);
    assert.equal(peak, 2);
    assert.equal(queue.getStatus().activeDownloads, 0);
});

test('a rejected job frees its slot and does not block later jobs', async () => {
    const queue = new DownloadQueue(1);
    const broken = queue.addJob(async () => { throw new Error('failed'); });
    const next = queue.addJob(async () => 'done');
    await assert.rejects(broken, /failed/);
    assert.equal(await next, 'done');
    assert.equal(queue.getStatus().activeDownloads, 0);
});

test('transient failures retry with bounded backoff; auth failures do not loop', async () => {
    let calls = 0;
    const waits = [];
    const result = await retry(async () => {
        calls++;
        if (calls < 3) throw new Error('connection timed out');
        return 'downloaded';
    }, { wait: async delay => waits.push(delay) });
    assert.equal(result, 'downloaded');
    assert.deepEqual(waits, [1000, 2000]);
    let authCalls = 0;
    await assert.rejects(retry(async () => {
        authCalls++;
        throw new Error('Login required');
    }), /Login required/);
    assert.equal(authCalls, 1);
});
