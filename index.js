require("dotenv").config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { Bot, GrammyError, HttpError, InputFile, InlineKeyboard } = require("grammy");

// Import our new modular services
const DownloaderFactory = require('./downloaders/DownloaderFactory');
const DownloadService = require('./services/DownloadService');
const UIService = require('./services/UIService');
const { botConfig } = require('./config/platforms');

const pendingDownloads = new Map();
let messagesIds = [];

const bot = new Bot(process.env.BOT_API_KEY);

// Periodic cleanup of old downloads
setInterval(() => {
    DownloadService.periodicCleanup();
}, botConfig.cleanupInterval);

bot.command("start", async (ctx) => {
    await ctx.reply(`Hello, I am TubobubaBot! I help you to download videos from YouTube, Instagram and TikTok. Just send me a link to the video you want to download. To support the bot, you can buy me a coffee: ${process.env.BUY_ME_A_COFFEE_URL}`);
});

bot.on("message:voice", async (ctx) => {
    await ctx.reply("Voice messages are not supported yet. ");
});

bot.on("message:entities:url", async (ctx) => {
    const message = ctx.message;
    const text = message.text;
    const entities = message.entities.filter(entity => entity.type === 'url');

    let validLinks = [];
    for (const entity of entities) {
        const url = text.substring(entity.offset, entity.offset + entity.length);

        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();

            // Check if URL is supported by any platform
            if (DownloaderFactory.isSupported(url)) {
                validLinks.push({ url, hostname });
            }
        } catch (e) {
            await ctx.reply(`Invalid URL: ${url}`);
        }
    }

    if (validLinks.length > 0) {
        const { url, hostname } = validLinks[0];

        console.log("Processing URL:", url, "from hostname:", hostname);

        try {
            // Create appropriate downloader
            const downloader = DownloaderFactory.createDownloader(url);

            // Get video info
            const info = await downloader.getInfo();
            console.log("Video info:", info);

            // Store pending download with downloader instance
            pendingDownloads.set(ctx.from.id, {
                downloader,
                info,
                userMessageId: ctx.message.message_id
            });

            // Create format keyboard based on platform capabilities
            const formatKeyboard = UIService.createFormatKeyboard(info.platform, info.title);

            // Send format selection message
            const messageId = await ctx.reply(
                `Choose the format you want to download for "${info.title}":`,
                { reply_markup: formatKeyboard }
            );
            messagesIds.push(messageId.message_id);

        } catch (error) {
            console.error("Error processing URL:", error);
            await ctx.reply(`Error fetching video info: ${error.message}`);
        }
    } else {
        const supportedPlatforms = DownloaderFactory.getSupportedPlatforms();
        const platformList = supportedPlatforms.map(p => p.name).join(', ');
        await ctx.reply(`No valid links found. Supported platforms: ${platformList}`);
    }
});

bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const pending = pendingDownloads.get(ctx.from.id);
    if (!pending) {
        await ctx.answerCallbackQuery("No pending download.");
        return;
    }

    await ctx.answerCallbackQuery(); // Acknowledge the callback

    const { downloader, info, userMessageId } = pending;
    pendingDownloads.delete(ctx.from.id);

    if (data === "delete_message") {
        try {
            await ctx.api.deleteMessage(ctx.chat.id, userMessageId);
            await ctx.reply("Message deleted.");
        } catch (e) {
            console.log("Failed to delete user message:", e.message);
            await ctx.reply("Failed to delete message.");
        }
        return;
    }

    let format, resolution;
    if (data === "audio") {
        format = "audio";
    } else if (data === "cancel") {
        await ctx.reply("Download cancelled.");
        return;
    } else if (data.startsWith("video_")) {
        format = "video";
        resolution = data.split("_")[1];
    } else {
        await ctx.reply("Invalid choice.");
        return;
    }

    // Send processing message
    const processingMessage = await ctx.reply(
        UIService.createProgressMessage(info.platform, format, resolution)
    );
    messagesIds.push(processingMessage.message_id);

    try {
        // Use the download service
        const result = await DownloadService.downloadContent(
            downloader,
            format,
            resolution,
            ctx.from.id
        );

        if (result.needsSplit) {
            // Handle split files
            for (let i = 0; i < result.filePaths.length; i++) {
                const partPath = result.filePaths[i];
                const partTitle = `${info.title} Part ${i + 1}`;
                const sanitizedPartTitle = partTitle.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
                const actualExt = path.extname(partPath);

                if (format === "audio") {
                    await ctx.replyWithAudio(
                        new InputFile(fs.createReadStream(partPath), `${sanitizedPartTitle}${actualExt}`),
                        { performer: info.uploader, title: partTitle, caption: partTitle }
                    );
                } else {
                    await ctx.replyWithVideo(
                        { caption: partTitle }
                    );
                }
                fs.unlinkSync(partPath);
            }
        } else {
            // Handle single file
            const sanitizedTitle = info.title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
            const actualExt = path.extname(result.filePath);

            if (format === "audio") {
                await ctx.replyWithAudio(
                    new InputFile(fs.createReadStream(result.filePath), `${sanitizedTitle}${actualExt}`),
                    { performer: info.uploader, title: info.title, caption: info.title }
                );
            } else {
                await ctx.replyWithVideo(
                    new InputFile(fs.createReadStream(result.filePath), `${sanitizedTitle}${actualExt}`),
                    { performer: info.uploader, title: info.title, caption: info.title }
                );
            }
            fs.unlinkSync(result.filePath);
        }

    } catch (error) {
        console.error("Download error:", error);
        await ctx.reply(UIService.createErrorMessage(error.message, info.platform));
    }

    // Clean up bot messages
    try {
        for (const messageId of messagesIds) {
            await ctx.api.deleteMessage(ctx.chat.id, messageId);
        }
    } catch (e) {
        console.log("Failed to delete message:", e.message);
    }
    messagesIds = [];
});

bot.catch((err) => {
    const ctx = err.ctx;
    console.error("Error in bot:", ctx.update.update_id, err.error);
    const e = err.error;
    if (e && e instanceof GrammyError) {
        console.error("Request Error:", e.description);

    } else if (e && e instanceof HttpError  ) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown Error:", e);
    }

});

bot.start();