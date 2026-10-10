#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
    echo 'Install Node.js 22+ and npm first.'
    exit 1
fi

if ! command -v ffmpeg >/dev/null && [ ! -x /opt/homebrew/bin/ffmpeg ] && [ ! -x /usr/local/bin/ffmpeg ]; then
    if command -v brew >/dev/null; then
        brew install ffmpeg
    elif [ -x /opt/homebrew/bin/brew ]; then
        /opt/homebrew/bin/brew install ffmpeg
    else
        echo 'Install ffmpeg (including ffprobe), then run setup again.'
        exit 1
    fi
fi

npm install
# Update the bundled executable used by the bot, not an unrelated system copy.
npm run update:yt-dlp
mkdir -p temp
if [ ! -f .env ]; then
    cp .env.example .env
    echo 'Set BOT_API_KEY in .env before starting the bot.'
fi
echo 'Setup complete. Start with npm start. See README.md for uploads up to 2000 MB.'
