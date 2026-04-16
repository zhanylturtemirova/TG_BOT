require("dotenv").config();
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const  {Bot, GrammyError, HttpError, InputFile, InlineKeyboard} = require("grammy");

const pendingDownloads = new Map();

const bot = new Bot(process.env.BOT_API_KEY);
bot.api.setMyCommands([
    {command: "start", description: "Start the bot"},   
        {command: "hello", description: "Say hello to the bot"},   

]).catch(e => console.log("Failed to set commands:", e.message));
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
            if (hostname.includes('youtube.com') || hostname.includes('youtu.be') || 
                hostname.includes('instagram.com') || hostname.includes('tiktok.com')) {
                validLinks.push({ url, hostname });
            }
        } catch (e) {
            await ctx.reply(`Invalid URL: ${url}`);

        }
    }
    
    if (validLinks.length > 0) {
        const { url, hostname } = validLinks[0];

        console.log("Processing URL:", url, "from hostname:", hostname);
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            try {
                // Get video info
                const info = await youtubedl(url, { dumpSingleJson: true, noDownload: true });
                const title = info.title;
                const duration = info.duration;
                const performer = info.uploader;
                console.log("Video title:", title, "Duration:", duration, "Uploader:", performer);

                pendingDownloads.set(ctx.from.id, { url, hostname, info, title, duration, performer });
                const formatKeyboard = new InlineKeyboard()
                    .text("🎵 Audio", "audio")
                    .row()
                    .text("🎥 Video 144p", "video_144")
                    .row()
                    .text("🎥 Video 260p", "video_260")
                    .row()
                    .text("🎥 Video 360p", "video_360")
                    .row()
                    .text("🎥 Video 480p", "video_480")
                    .row()
                    .text("🎥 Video 720p", "video_720")
                    .row()
                    .text("🎥 Video 1080p", "video_1080")
                    .row()
                    .text("❌ Cancel", "cancel");
                await ctx.reply(`Choose the format you want to download for "${title}":`, { reply_markup: formatKeyboard });
            } catch (error) {
                await ctx.reply("Error fetching video info: " + error.message);
            }
        } else {
            await ctx.reply("Downloading from Instagram or TikTok is not supported yet.");
        }
    } else {
        await ctx.reply("No valid links from YouTube, Instagram, or TikTok found.");
    }
});
// bot.on("message",   async (ctx) => {
//     await ctx.reply("You said: " + ctx.message.text);
// });
// bot.on("msg").filter( (ctx) =>{
//     console.log("Received message from:", ctx.from.id);
//     return ctx.from.id === Number(process.env.TG_ID); 
// }, async (ctx) => {
//         await ctx.reply("Hello admin!")
//     }
// )
bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const pending = pendingDownloads.get(ctx.from.id);
    if (!pending) {
        await ctx.answerCallbackQuery("No pending download.");
        return;
    }

    await ctx.answerCallbackQuery(); // Acknowledge the callback
    pendingDownloads.delete(ctx.from.id);

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

    const { url, info, title, performer, duration } = pending;
    await ctx.reply(`Processing YouTube ${format}${resolution ? ` ${resolution}p` : ''}...`);

    try {
        let outputPath;
        if (format === "audio") {
            outputPath = path.join(__dirname, `output_${Date.now()}.mp3`);
            console.log("Downloading audio to:", outputPath);
            await youtubedl(url, {
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: '64K',
                output: outputPath
            });
        } else if (format === "video") {
            outputPath = path.join(__dirname, `output_${Date.now()}.mp4`);
            console.log("Downloading video to:", outputPath);
            console.log(`Using format filter: bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`);
            await youtubedl(url, {
                output: outputPath,
                format: `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`
            });
        }

        console.log("Download complete, sending file...");
        // Find the actual downloaded file (yt-dlp may change extension)
        const possibleFiles = fs.readdirSync(__dirname).filter(f => f.startsWith('output_') && (f.endsWith('.mp3') || f.endsWith('.mp4') || f.endsWith('.webm')));
        if (possibleFiles.length === 0) {
            await ctx.reply("Failed to download the file.");
            return;
        }
        const actualOutputPath = path.join(__dirname, possibleFiles[0]);
        console.log("Actual file path:", actualOutputPath);

        try {
            const stat = fs.statSync(actualOutputPath);
            if (stat.size > 0) {
                const fileSize = stat.size;
                console.log("File size:", fileSize);
                if (fileSize > 50 * 1024 * 1024) { // 50 MB limit
                    console.log("File too large, splitting into parts...");
                    const maxSize = 45 * 1024 * 1024;
                    const numParts = Math.ceil(fileSize / maxSize);
                    const segmentTime = Math.floor(duration / numParts);
                    const baseName = path.basename(actualOutputPath, path.extname(actualOutputPath));
                    const ext = path.extname(actualOutputPath);
                    const segmentPattern = path.join(__dirname, `${baseName}_%03d${ext}`);
                    execSync(`ffmpeg -i "${actualOutputPath}" -f segment -segment_time ${segmentTime} -c copy "${segmentPattern}"`);
                    
                    const parts = fs.readdirSync(__dirname)
                        .filter(f => f.startsWith(baseName + '_') && f.endsWith(ext))
                        .sort();
                    
                    for (let i = 0; i < parts.length; i++) {
                        const partPath = path.join(__dirname, parts[i]); 
                        const partTitle = `${title} Part ${i + 1}`;
                        const sanitizedPartTitle = partTitle.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
                        if (format === "audio") {
                            await ctx.replyWithAudio(new InputFile(fs.createReadStream(partPath), `${sanitizedPartTitle}.mp3`), { performer, title: partTitle, caption: partTitle });
                        } else {
                            await ctx.replyWithVideo(new InputFile(fs.createReadStream(partPath), `${sanitizedPartTitle}.mp4`), { caption: partTitle });
                        }
                        fs.unlinkSync(partPath);
                    }
                    fs.unlinkSync(actualOutputPath);
                    return;
                }

                const sanitizedTitle = title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
                if (format === "audio") {
                    await ctx.replyWithAudio(new InputFile(fs.createReadStream(actualOutputPath), `${sanitizedTitle}.mp3`), { performer, title, caption: title });
                } else {
                    await ctx.replyWithVideo(new InputFile(fs.createReadStream(actualOutputPath), `${sanitizedTitle}.mp4`), { performer, title, caption: title });
                }
                fs.unlinkSync(actualOutputPath);
            } else {
                await ctx.reply("Downloaded file is empty.");
            }
        } catch (e) {
            console.log("File processing error:", e.message);
            await ctx.reply("Failed to process the file.");
        }
    } catch (error) {
        await ctx.reply("Error processing the video: " + error.message);
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