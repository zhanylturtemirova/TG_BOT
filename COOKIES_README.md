# YouTube Cookies Setup Guide

To improve YouTube access and avoid "Sign in to confirm you're not a bot" errors, you can export your YouTube cookies.

## Method 1: Using yt-dlp (Recommended)

1. **Install browser cookies extension** (if using Chrome/Firefox)
2. **Export cookies**:
   ```bash
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt
   ```
   Replace `chrome` with `firefox`, `safari`, or `edge` depending on your browser.

3. **Place the file**: Put `cookies.txt` in the bot's root directory.

## Method 2: Manual Cookie Export

1. **Install "Get cookies.txt" extension** for your browser
2. **Visit YouTube** and log in
3. **Export cookies** to `cookies.txt`
4. **Place the file** in the bot's root directory

## Method 3: Using Browser DevTools

1. **Open YouTube** in your browser and log in
2. **Open DevTools** (F12)
3. **Go to Application/Storage > Cookies**
4. **Export cookies** in Netscape format
5. **Save as `cookies.txt`** in the bot's root directory

## Important Notes

- **Privacy**: Only share cookies with applications you trust
- **Expiration**: Cookies expire, you may need to update them periodically
- **Security**: Never commit `cookies.txt` to version control
- **Optional**: The bot works without cookies, but they help with rate limiting

## Troubleshooting

If cookies don't work:
1. Make sure you're logged into YouTube
2. Try a different browser
3. Check that the cookies file is in the correct format
4. The bot will still work without cookies (just with more retries)