const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { args, constants } = require('youtube-dl-exec');

const run = promisify(execFile);
const root = path.resolve(__dirname, '..');

// tinyspawn (used by youtube-dl-exec) splits executable paths on spaces.
// Pass the executable and arguments separately, without a shell.
async function ytdlp(url, flags = {}) {
    const binary = process.env.YT_DLP_PATH || constants.YOUTUBE_DL_PATH;
    const options = { ignoreConfig: true, noCacheDir: true, noProgress: true,
        socketTimeout: 30, retries: 3, ...flags };
    const ffmpegDir = process.env.FFMPEG_LOCATION ||
        ['/opt/homebrew/bin', '/usr/local/bin'].find(dir => fs.existsSync(path.join(dir, 'ffmpeg')));
    if (ffmpegDir) options.ffmpegLocation = ffmpegDir;
    try {
        const { stdout } = await run(binary, [...args(options), '--', url], {
            maxBuffer: 32 * 1024 * 1024,
            timeout: 30 * 60 * 1000,
            windowsHide: true
        });
        return options.dumpSingleJson ? JSON.parse(stdout) : stdout;
    } catch (error) {
        // Preserve ENOENT and extractor diagnostics instead of replacing them with "Error".
        if (error.code === 'ENOENT') {
            throw new Error('yt-dlp executable not found. Run npm install or set YT_DLP_PATH.');
        }
        const details = error.stderr?.trim() || error.message;
        const failure = new Error(details);
        failure.code = error.code;
        throw failure;
    }
}

function cookieOptions(platform) {
    const configured = process.env[`${platform.toUpperCase()}_COOKIES_FILE`];
    const file = configured ? path.resolve(root, configured) : path.join(root, 'cookies.txt');
    if (configured && !fs.existsSync(file)) {
        throw new Error(`${platform.toUpperCase()}_COOKIES_FILE does not exist.`);
    }
    return fs.existsSync(file) ? { cookies: file } : {};
}

module.exports = ytdlp;
module.exports.cookieOptions = cookieOptions;
