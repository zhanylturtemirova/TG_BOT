const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { getTelegramConfig } = require('../config/telegram');
const { DownloadService } = require('../services/DownloadService');
const ytdlp = require('../services/YtDlp');
const YouTubeDownloader = require('../downloaders/YouTubeDownloader');
const InstagramDownloader = require('../downloaders/InstagramDownloader');

const cloud = getTelegramConfig({});
const local = getTelegramConfig({ TELEGRAM_LOCAL_MODE: 'true', TELEGRAM_API_ROOT: 'http://127.0.0.1:8081/' });

function fakeDownloader(size, failure = false) {
    // Only the platform contract matters, not the constructor name.
    return new class FakeDownloader {
        platform = 'instagram';
        async download(output) {
            await fs.writeFile(output, 'media');
            await fs.truncate(output, size); // Sparse fixtures, no real 2 GB allocation.
            await fs.writeFile(output.replace('.mp4', '.f137.mp4'), 'intermediate');
            if (failure) throw new Error('network interrupted');
        }
    }();
}

test('local uploads require an explicit custom API origin', () => {
    assert.equal(cloud.maxFileSize, 50_000_000);
    assert.equal(local.maxFileSize, 2_000_000_000);
    assert.equal(local.apiRoot, 'http://127.0.0.1:8081');
    assert.throws(() => getTelegramConfig({ TELEGRAM_LOCAL_MODE: 'true' }), /own Bot API/);
    assert.throws(() => getTelegramConfig({ TELEGRAM_API_ROOT: 'http://localhost/botSECRET' }), /origin/);
    assert.equal(getTelegramConfig({ TELEGRAM_API_ROOT: 'http://localhost:8081' }).maxFileSize, cloud.maxFileSize);
});

test('a file at the cloud limit is accepted whole and cleanup removes intermediate streams', async () => {
    const service = new DownloadService(cloud);
    const result = await service.downloadContent(fakeDownloader(cloud.maxFileSize), 'video', 'best', 'test');
    assert.equal(result.needsSplit, false);
    assert.equal(path.basename(result.filePath), 'output.mp4');
    await service.cleanup(result.downloadId);
    await assert.rejects(fs.stat(path.dirname(result.filePath)), {code:'ENOENT'});
    assert.equal(service.activeDownloads.size, 0);
});

test('oversized cloud downloads fail clearly and clean up instead of splitting', async () => {
    const service = new DownloadService(cloud);
    await assert.rejects(service.downloadContent(fakeDownloader(cloud.maxFileSize + 1), 'video', 'best', 'test'),
        {code:'FILE_TOO_LARGE'});
    assert.equal(service.activeDownloads.size, 0);
});

test('local policy accepts a 60 MB file whole and enforces its own upper boundary', async () => {
    const service = new DownloadService(local);
    const result = await service.downloadContent(fakeDownloader(60_000_000), 'video', 'best', 'test');
    assert.equal(result.fileSize, 60_000_000);
    assert.equal(result.needsSplit, false);
    await service.cleanup(result.downloadId);
    await assert.rejects(service.downloadContent(fakeDownloader(local.maxFileSize + 1), 'video', 'best', 'test'),
        {code:'FILE_TOO_LARGE'});
    assert.equal(service.activeDownloads.size, 0);
});

test('partial downloads are removed on extractor failure', async () => {
    const service = new DownloadService(cloud);
    await assert.rejects(service.downloadContent(fakeDownloader(100, true), 'video', 'best', 'test'), /network interrupted/);
    assert.equal(service.activeDownloads.size, 0);
});

test('runner supports executable paths with spaces, preserves errors, and passes quality/cookies consistently', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bot test with spaces '));
    const binary = path.join(dir, 'fake yt-dlp');
    const capture = path.join(dir, 'arguments.json');
    const cookies = path.join(dir, 'empty cookies.txt');
    const previous = { ...process.env };
    try {
        await fs.writeFile(cookies, '# Netscape HTTP Cookie File\n');
        await fs.writeFile(binary, `#!${process.execPath}\n` + `
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(process.env.TEST_CAPTURE, JSON.stringify(args));
if (args.includes('fail')) { process.stderr.write('extractor diagnostic'); process.exit(1); }
console.log(JSON.stringify({entries:[{title:'A reel', formats:[{url:'https://example.com/video.mp4'}]}]}));
`, {mode:0o755});
        process.env.YT_DLP_PATH = binary;
        process.env.TEST_CAPTURE = capture;
        process.env.YOUTUBE_COOKIES_FILE = cookies;
        process.env.INSTAGRAM_COOKIES_FILE = cookies;
        const link = 'https://www.instagram.com/reel/example/?a=1&b=$(echo secret)';
        const info = await new InstagramDownloader(link).getInfo();
        assert.equal(info.title, 'A reel');
        let argv = JSON.parse(await fs.readFile(capture, 'utf8'));
        assert.equal(argv.at(-1), link);
        assert.equal(argv.at(-2), '--');
        assert.equal(argv[argv.indexOf('--cookies') + 1], cookies);
        assert.equal(argv[argv.indexOf('--playlist-items') + 1], '1');
        await new InstagramDownloader(link).download(path.join(dir,'output.mp4'), {format:'video'});
        argv = JSON.parse(await fs.readFile(capture, 'utf8'));
        assert.equal(argv[argv.indexOf('--cookies') + 1], cookies);
        const yt = new YouTubeDownloader('https://youtube.com/watch?v=example');
        await yt.download(path.join(dir,'output.mp4'), {format:'video',resolution:'360'});
        argv = JSON.parse(await fs.readFile(capture, 'utf8'));
        const formats = argv[argv.indexOf('--format') + 1].split('/');
        assert.ok(formats.every(format => format.includes('[height<=360]')));
        assert.ok(argv.includes('--no-playlist'));
        await yt.download(path.join(dir,'output.mp3'), {format:'audio'});
        argv = JSON.parse(await fs.readFile(capture, 'utf8'));
        assert.ok(argv.includes('--extract-audio'));
        assert.equal(argv[argv.indexOf('--audio-format') + 1], 'mp3');
        await assert.rejects(ytdlp('fail'), /extractor diagnostic/);
        process.env.YT_DLP_PATH = path.join(dir, 'missing');
        await assert.rejects(ytdlp(link), /executable not found/);
    } finally {
        for (const key of ['YT_DLP_PATH','TEST_CAPTURE','YOUTUBE_COOKIES_FILE','INSTAGRAM_COOKIES_FILE']) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
        await fs.rm(dir, {recursive:true, force:true});
    }
});
