# TubobubaBot - Multi-Platform Video Downloader

A Telegram bot that can download videos from multiple social media platforms including YouTube, Instagram, and TikTok.

## Architecture Overview

This bot uses a modular, extensible architecture that makes it easy to add support for new platforms.

### Core Components

#### 1. Downloaders (`/downloaders/`)
Each platform has its own downloader class that extends `BaseDownloader`:

- **BaseDownloader.js**: Abstract base class defining the interface
- **YouTubeDownloader.js**: Handles YouTube videos
- **InstagramDownloader.js**: Handles Instagram videos
- **TikTokDownloader.js**: Handles TikTok videos

#### 2. Services (`/services/`)
- **DownloadService.js**: Handles the download process, file management, and cleanup
- **UIService.js**: Manages UI elements like keyboards and messages

#### 3. Configuration (`/config/`)
- **platforms.js**: Platform-specific settings and capabilities

#### 4. Factory Pattern
- **DownloaderFactory.js**: Creates appropriate downloader instances based on URL

## Adding a New Platform

To add support for a new platform (e.g., Twitter/X), follow these steps:

### 1. Create a Downloader Class

```javascript
// downloaders/TwitterDownloader.js
const BaseDownloader = require('./BaseDownloader');

class TwitterDownloader extends BaseDownloader {
    async getInfo() {
        // Implement platform-specific info extraction
        const info = await this.fetchVideoInfo();
        return {
            title: info.title,
            duration: info.duration,
            uploader: info.author,
            platform: 'Twitter',
            // ... other metadata
        };
    }

    async download(outputPath, options = {}) {
        // Implement download logic
        const { format } = options;
        // Download logic here
    }

    getSupportedFormats() {
        return ['video']; // Twitter might only support video
    }

    getVideoResolutions() {
        return ['best'];
    }
}

module.exports = TwitterDownloader;
```

### 2. Update the Factory

```javascript
// downloaders/DownloaderFactory.js
const TwitterDownloader = require('./TwitterDownloader');

static createDownloader(url) {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return new YouTubeDownloader(url);
    } else if (hostname.includes('instagram.com')) {
        return new InstagramDownloader(url);
    } else if (hostname.includes('tiktok.com')) {
        return new TikTokDownloader(url);
    } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return new TwitterDownloader(url); // New platform
    } else {
        throw new Error(`Unsupported platform: ${hostname}`);
    }
}

static getSupportedPlatforms() {
    return [
        { name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
        { name: 'Instagram', domains: ['instagram.com'] },
        { name: 'TikTok', domains: ['tiktok.com'] },
        { name: 'Twitter', domains: ['twitter.com', 'x.com'] } // New platform
    ];
}
```

### 3. Add Platform Configuration

```javascript
// config/platforms.js
twitter: {
    name: 'Twitter',
    maxFileSize: 50 * 1024 * 1024,
    supportedFormats: ['video'],
    videoResolutions: ['best'],
    audioQuality: '64K',
    audioFormat: 'mp3'
}
```

### 4. Update Dependencies

Add any required npm packages for the new platform to `package.json`.

## Best Practices Implemented

### 1. **Strategy Pattern**
- Each platform implements the same interface
- Easy to swap implementations
- Consistent behavior across platforms

### 2. **Factory Pattern**
- Centralized platform detection and instantiation
- Easy to add new platforms without modifying existing code

### 3. **Configuration-Driven Design**
- Platform capabilities defined in config files
- Easy to modify behavior without code changes

### 4. **Error Handling**
- Platform-specific error messages
- Graceful degradation
- Comprehensive logging

### 5. **Resource Management**
- Automatic cleanup of temporary files
- Memory-efficient streaming
- Periodic cleanup of old downloads

### 6. **Modular Architecture**
- Separation of concerns
- Single responsibility principle
- Easy to test and maintain

## Features

- ✅ Multi-platform support (YouTube, Instagram, TikTok)
- ✅ Audio and video downloads
- ✅ Automatic file splitting for large files
- ✅ Message cleanup
- ✅ User-friendly error messages
- ✅ Configurable quality options
- ✅ Automatic cleanup

## Future Enhancements

- Add more platforms (Twitter, Facebook, etc.)
- Implement rate limiting
- Add download progress indicators
- Support for playlists/channels
- User preferences and history
- Admin panel for monitoring

## Installation & Setup

1. Clone the repository
2. Run the setup script: `./setup.sh`
3. Create `.env` file with your bot token
4. Run: `npm start`

## Environment Variables

- `BOT_API_KEY`: Your Telegram bot token
- `BUY_ME_A_COFFEE_URL`: Optional donation link

## Troubleshooting YouTube Issues

### Common Errors and Solutions

#### 1. HTTP Error 429: Too Many Requests
**Cause**: YouTube rate limiting
**Solutions**:
- Wait 5-10 minutes before trying again
- Add YouTube cookies (see below)
- The bot automatically retries with exponential backoff

#### 2. "Sign in to confirm you're not a bot"
**Cause**: YouTube bot detection
**Solution**: Add YouTube cookies
```bash
# Export cookies from your browser
yt-dlp --cookies-from-browser chrome --cookies cookies.txt
# Or manually create cookies.txt with YouTube session cookies
```

#### 3. "No supported JavaScript runtime"
**Cause**: Missing JavaScript runtime for yt-dlp
**Solutions**:
- Install Deno: `brew install deno`
- Or the setup script will handle this automatically

#### 4. "Unable to download webpage"
**Cause**: Network issues or geo-blocking
**Solutions**:
- Check your internet connection
- Try using a VPN
- The bot uses geo-bypass options automatically

### Manual Setup (if setup.sh doesn't work)

```bash
# Install dependencies
brew install deno yt-dlp ffmpeg

# Install Node.js dependencies
npm install

# Create temp directory
mkdir temp

# Create .env file
echo "BOT_API_KEY=your_bot_token_here" > .env
```

### Performance Tips

- **Rate Limiting**: The bot includes automatic retry logic with exponential backoff
- **Caching**: Consider adding Redis for caching video info
- **Concurrent Downloads**: Currently processes one download at a time per user
- **File Cleanup**: Temporary files are automatically cleaned up

## Usage

Send a video link from supported platforms to the bot, and it will process and send the audio/video file back.

## License

ISC