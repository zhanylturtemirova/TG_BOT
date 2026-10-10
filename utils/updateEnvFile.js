const fs = require('node:fs/promises');

async function updateEnvFile(filePath, settings) {
    const contents = await fs.readFile(filePath, 'utf8');
    const keys = new Set(Object.keys(settings));
    const retained = contents.split(/\r?\n/).filter(line => {
        const assignment = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=/);
        return !assignment || !keys.has(assignment[1]);
    }).join('\n').trimEnd();
    const updated = `${retained}\n${Object.entries(settings).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
    const staging = `${filePath}.switch-${process.pid}`;
    let created = false;
    try {
        await fs.writeFile(staging, updated, { mode: 0o600, flag: 'wx' });
        created = true;
        await fs.rename(staging, filePath);
    } finally {
        if (created) await fs.rm(staging, { force: true });
    }
}

module.exports = { updateEnvFile };
