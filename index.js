require("dotenv").config();
const path = require('path');

const { Bot, GrammyError, HttpError, InputFile } = require("grammy");

// Import our new modular services
const DownloaderFactory = require('./downloaders/DownloaderFactory');
const DownloadService = require('./services/DownloadService');
const DownloadQueue = require('./services/DownloadQueue');
const UIService = require('./services/UIService');
const { getTelegramConfig } = require('./config/telegram');

const pendingDownloads = new Map();

// Create download queue with max 2 concurrent downloads
const downloadQueue = new DownloadQueue(2);

const telegram = getTelegramConfig();
const bot = new Bot(process.env.BOT_API_KEY, {
    client: { apiRoot: telegram.apiRoot, timeoutSeconds: telegram.timeoutSeconds }
});

bot.command("start", async (ctx) => {
    await ctx.reply(`Hello, I am TubobubaBot! I help you to download videos from YouTube, Instagram and TikTok. Just send me a link to the video you want to download. To support the bot, you can buy me a coffee: ${process.env.BUY_ME_A_COFFEE_URL}`);
});

bot.command("queue", async (ctx) => {
    const status = downloadQueue.getStatus();
    const userPosition = downloadQueue.getQueuePosition(ctx.from.id);

    let message = `📊 **Download Queue Status**\n\n`;
    message += `🎯 **Active Downloads:** ${status.activeDownloads}/${status.maxConcurrent}\n`;
    message += `📋 **Queued Jobs:** ${status.queueLength}\n`;

    if (userPosition.position > 0) {
        const waitMinutes = Math.ceil(userPosition.estimatedWait / (60 * 1000));
        message += `⏰ **Your Position:** ${userPosition.position} in queue\n`;
        message += `⏱️ **Estimated Wait:** ${waitMinutes} minutes\n`;
    } else {
        message += `✅ **Your download can start immediately!**\n`;
    }

    if (status.activeJobs.length > 0) {
        message += `\n🔄 **Active Jobs:**\n`;
        status.activeJobs.forEach(job => {
            const duration = Math.floor(job.duration / 1000 / 60); // minutes
            message += `• Job ${String(job.id).slice(-4)}: ${job.status} (${duration}min)\n`;
        });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
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
                userMessageId: ctx.message.message_id,
                chatId: ctx.chat.id
            });

            // Create format keyboard based on platform capabilities
            const formatKeyboard = UIService.createFormatKeyboard(info.platform, info.title);

            // Check queue status
            const queueStatus = downloadQueue.getStatus();
            const queueInfo = queueStatus.activeDownloads >= queueStatus.maxConcurrent ?
                `\n\n📋 **Queue Status:** ${queueStatus.queueLength} in queue, ${queueStatus.activeDownloads} active` :
                `\n\n✅ **Ready to download immediately!**`;

            // Send format selection message
            const messageId = await ctx.reply(
                `Choose the format you want to download for "${info.title}":${queueInfo}`,
                { reply_markup: formatKeyboard }
            );
            pendingDownloads.get(ctx.from.id).selectionMessageId = messageId.message_id;

        } catch (error) {
            console.error("Error processing URL:", error);
            await ctx.reply(UIService.createErrorMessage(error));
        }
    } else {
        const supportedPlatforms = DownloaderFactory.getSupportedPlatforms();
        const platformList = supportedPlatforms.map(p => p.name).join(', ');
        await ctx.reply(`No valid links found. Supported platforms: ${platformList}`);
    }
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const pending = pendingDownloads.get(ctx.from.id);
    if (!pending || pending.chatId !== ctx.chat?.id ||
        pending.selectionMessageId !== ctx.callbackQuery.message?.message_id) {
        await ctx.answerCallbackQuery("No pending download.");
        return;
    }

    await ctx.answerCallbackQuery(); // Acknowledge the callback

    const { downloader, info, userMessageId, selectionMessageId } = pending;
    const messagesIds = [selectionMessageId];
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

    // Send initial processing message
    const processingMessage = await ctx.reply(
        `⏳ ${UIService.createProgressMessage(info.platform, format, resolution)}\n\n📋 **Added to download queue...**`
    );
    messagesIds.push(processingMessage.message_id);

    // Create download job function
    const downloadJob = async () => {
        let result;
        try {
            // Update message to show download started
            await ctx.api.editMessageText(
                ctx.chat.id,
                processingMessage.message_id,
                `▶️ ${UIService.createProgressMessage(info.platform, format, resolution)}\n\n📥 **Downloading...**`
            );

            // Use the download service
            result = await DownloadService.downloadContent(
                downloader,
                format,
                resolution,
                ctx.from.id
            );

            // Update message to show sending
            await ctx.api.editMessageText(
                ctx.chat.id,
                processingMessage.message_id,
                `📤 ${UIService.createProgressMessage(info.platform, format, resolution)}\n\n📨 **Sending file...**`
            );

            const sanitizedTitle = info.title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 80);
            const actualExt = path.extname(result.filePath);
            const input = new InputFile(result.filePath, `${sanitizedTitle}${actualExt}`);
            const caption = info.title.substring(0, 1024);
            if (format === "audio") {
                await ctx.replyWithAudio(input, { performer: info.uploader, title: info.title, caption });
            } else if (actualExt === '.mp4') {
                await ctx.replyWithVideo(input, { caption, supports_streaming: true });
            } else {
                await ctx.replyWithDocument(input, { caption });
            }

            return { success: true };

        } catch (error) {
            console.error('Download job error:', error);
            throw error;
        } finally {
            if (result) await DownloadService.cleanup(result.downloadId);
        }
    };

    // Add job to queue
    try {
        await downloadQueue.addJob(downloadJob);
    } catch (queueError) {
        console.error('Queue error:', queueError);
        await ctx.reply(UIService.createErrorMessage(queueError));
        if (queueError.code === 'FILE_TOO_LARGE' && !pendingDownloads.has(ctx.from.id)) {
            const selection = await ctx.reply('Выберите другое качество или аудио:', {
                reply_markup: UIService.createFormatKeyboard(info.platform, info.title)
            });
            pendingDownloads.set(ctx.from.id, { ...pending, selectionMessageId: selection.message_id });
        }
    }

    // Clean up bot messages
    try {
        for (const messageId of messagesIds) {
            await ctx.api.deleteMessage(ctx.chat.id, messageId);
        }
    } catch (e) {
        console.log("Failed to delete message:", e.message);
    }
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