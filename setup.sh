#!/bin/bash

echo "🔧 Setting up TubobubaBot environment..."

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "⚠️  Deno not found. Installing deno (recommended for YouTube extraction)..."
    brew install deno
else
    echo "✅ Deno is already installed"
fi

# Check if yt-dlp is available
if ! command -v yt-dlp &> /dev/null; then
    echo "⚠️  yt-dlp not found. Installing yt-dlp..."
    brew install yt-dlp
else
    echo "✅ yt-dlp is already installed"
fi

# Check if ffmpeg is available
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg not found. Installing ffmpeg..."
    brew install ffmpeg
else
    echo "✅ ffmpeg is already installed"
fi

# Create temp directory
mkdir -p temp

# Check for cookies file
if [ ! -f "cookies.txt" ]; then
    echo "📝 Optional: To improve YouTube access, you can create a 'cookies.txt' file"
    echo "   Instructions: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
    echo "   This will help bypass some YouTube restrictions"
fi

# Check .env file
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "   Please create a .env file with your bot token:"
    echo "   BOT_API_KEY=your_telegram_bot_token_here"
    echo "   BUY_ME_A_COFFEE_URL=https://www.buymeacoffee.com/yourusername"
    exit 1
else
    echo "✅ .env file found"
fi

echo ""
echo "🎉 Setup complete! Run 'npm start' to start the bot."
echo ""
echo "📖 Troubleshooting:"
echo "   - If you get 429 errors: Wait a few minutes and try again"
echo "   - For persistent issues: Add YouTube cookies (see cookies.txt instructions)"
echo "   - Check logs for detailed error messages"