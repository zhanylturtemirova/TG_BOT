const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createBot } = require('../../bot/createBot');
const { DownloadService } = require('../../services/DownloadService');
const { getTelegramConfig } = require('../../config/telegram');
const factory = require('../../downloaders/DownloaderFactory');
const SelectionStore = require('../../services/SelectionStore');

async function createHarness(test, options = {}) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bot-functional-'));
    test.after(() => fs.rm(tempDir, { recursive: true, force: true }));
    const requests = [];
    const downloads = [];
    const telegram = options.telegram || getTelegramConfig({});
    const downloadService = new DownloadService(telegram, { tempDir });
    const selections = options.selections || new SelectionStore();
    let sequence = 100;
    const bot = createBot({
        token: '123:test-token',
        botInfo: { id: 123, is_bot: true, first_name: 'Test Bot', username: 'test_bot' },
        telegram, downloadService, selections,
        queue: options.queue,
        logger: { error() {}, warn() {} },
        factory: {
            isSupported: factory.isSupported,
            createDownloader(url) {
                const downloader = factory.createDownloader(url);
                // Replace only the external media process. Keep validation, metadata,
                // storage, size policy, handlers, keyboards, queue and grammY real.
                downloader.run = async (input, flags) => {
                    if (flags.dumpSingleJson) {
                        if (options.beforeInfo) await options.beforeInfo(input);
                        return { title: input, uploader: 'Test author', formats: [{ url: 'https://example.com/media' }] };
                    }
                    downloads.push({ url: input, flags });
                    await fs.writeFile(flags.output, 'fixture media bytes');
                    const size = typeof options.size === 'function' ? options.size(flags) : options.size;
                    if (size) await fs.truncate(flags.output, size);
                    if (options.downloadError) throw options.downloadError;
                    return '';
                };
                return downloader;
            }
        }
    });
    bot.api.config.use(async (_previous, method, payload) => {
        const messageId = sequence++;
        const request = { method, payload, messageId };
        requests.push(request);
        if (options.beforeApi) await options.beforeApi(method, payload);
        if (options.failMethod === method) throw new Error(`Simulated ${method} failure`);
        return { ok: true, result: method.startsWith('send')
            ? { message_id: messageId, chat: { id: payload.chat_id, type: 'private' }, text: payload.text }
            : true };
    });

    function textUpdate(text, { userId = 1, chatId = userId, entities } = {}) {
        const inferred = text.startsWith('/')
            ? [{ type: 'bot_command', offset: 0, length: text.length }]
            : [{ type: 'url', offset: 0, length: text.length }];
        return { update_id: sequence++, message: {
            message_id: sequence++, date: 1, text, entities: entities || inferred,
            from: { id: userId, is_bot: false, first_name: 'Tester' },
            chat: { id: chatId, type: 'private' }
        } };
    }

    function click(data, menuId, { userId = 1, chatId = userId } = {}) {
        return bot.handleUpdate({ update_id: sequence++, callback_query: {
            id: String(sequence++), chat_instance: 'test', data,
            from: { id: userId, is_bot: false, first_name: 'Tester' },
            message: { message_id: menuId, date: 1, chat: { id: chatId, type: 'private' } }
        } });
    }

    return {
        bot, requests, downloads, tempDir, downloadService, selections, click, textUpdate,
        send: (text, context) => bot.handleUpdate(textUpdate(text, context)),
        menu: () => requests.findLast(request => request.payload.reply_markup)?.messageId
    };
}

module.exports = { createHarness };
