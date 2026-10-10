require('dotenv').config();
const { run } = require('@grammyjs/runner');
const { createBot } = require('./bot/createBot');

async function main() {
    const bot = createBot({ token: process.env.BOT_API_KEY, donationUrl: process.env.BUY_ME_A_COFFEE_URL });
    await bot.init();
    // Keep receiving commands while up to two queued downloads are running.
    const runner = run(bot, { sink: { concurrency: 20 } });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => { void runner.stop(); });
    }
    console.log('Bot is ready.');
    await runner.task();
}

main().catch(error => {
    console.error('Unable to start bot:', error.message);
    process.exitCode = 1;
});
