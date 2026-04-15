require("dotenv").config();
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

const  {Bot, GrammyError, HttpError, InputFile} = require("grammy");

const bot = new Bot(process.env.BOT_API_KEY);
bot.api.setMyCommands([
    {command: "start", description: "Start the bot"},   
        {command: "hello", description: "Say hello to the bot"},   

])
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
            // Invalid URL, skip
        }
    }
    
    if (validLinks.length > 0) {
        const { url, hostname } = validLinks[0]; // Handle first link
        console.log("Processing URL:", url, "from hostname:", hostname);
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            await ctx.reply(`Processing YouTube video...`);
            try {
                // Get video info
                const info = await youtubedl(url, { dumpSingleJson: true, noDownload: true });
                const title = info.title;
                const duration = info.duration;
                console.log("Video title:", title, "Duration:", duration);

                const outputPath = path.join(__dirname, `output_${Date.now()}.mp3`);
                console.log("Downloading video and extracting audio to:", outputPath);
                await youtubedl(url, {
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: '64K',
                    output: outputPath
                });


                console.log("Download and extraction complete, sending audio...");
                if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                    const fileSize = fs.statSync(outputPath).size;
                    console.log("File size:", fileSize);
                    if (fileSize > 50 * 1024 * 1024) { // 50 MB limit
                        await ctx.reply("Audio file is too large to send (over 50MB).");
                        fs.unlinkSync(outputPath);
                        return;
                    }
                    const buffer = fs.readFileSync(outputPath);

                    console.log("Audio file read successfully, sending to user...");
                    const sanitizedTitle = title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50); 
                    await ctx.replyWithAudio(new InputFile(fs.createReadStream(outputPath), `${sanitizedTitle}.mp3`), { caption: title });
                    fs.unlinkSync(outputPath);
                } else {
                    await ctx.reply("Failed to download the audio file.");
                }
            } catch (error) {
                await ctx.reply("Error processing the video: " + error.message);
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
bot.hears([/hello/i], async (ctx) => {
    await ctx.reply("Hello there!");
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