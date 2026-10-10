const { setTimeout: sleep } = require('node:timers/promises');

function isTransientError(error) {
    return /timeout|timed out|connection|network|HTTP Error 5\d\d|temporarily unavailable/i.test(error.message);
}

async function retry(operation, { attempts = 3, wait = sleep } = {}) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt >= attempts || !isTransientError(error)) throw error;
            await wait(1000 * 2 ** (attempt - 1));
        }
    }
}

module.exports = { retry };
