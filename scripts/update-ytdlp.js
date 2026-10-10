require('dotenv').config({ quiet: true });
const { execFileSync } = require('node:child_process');
const { constants } = require('youtube-dl-exec');
execFileSync(process.env.YT_DLP_PATH || constants.YOUTUBE_DL_PATH, ['-U'], { stdio: 'inherit' });
