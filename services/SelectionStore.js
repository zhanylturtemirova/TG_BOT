class SelectionStore {
    constructor({ ttlMs = 15 * 60 * 1000, now = Date.now } = {}) {
        this.ttlMs = ttlMs;
        this.now = now;
        this.entries = new Map();
    }

    static ownerId(ctx) {
        return `${ctx.chat.id}:${ctx.from.id}`;
    }

    begin(ownerId) {
        this.removeExpired();
        const ticket = Symbol('selection');
        this.entries.set(ownerId, { ticket, expiresAt: this.now() + this.ttlMs });
        return ticket;
    }

    isCurrent(ownerId, ticket) {
        return this.get(ownerId)?.ticket === ticket;
    }

    complete(ownerId, ticket, selection) {
        if (!this.isCurrent(ownerId, ticket)) return false;
        this.entries.set(ownerId, { ...this.get(ownerId), ...selection });
        return true;
    }

    get(ownerId) {
        const entry = this.entries.get(ownerId);
        if (entry && entry.expiresAt <= this.now()) {
            this.entries.delete(ownerId);
            return undefined;
        }
        return entry;
    }

    take(ownerId, messageId) {
        const entry = this.get(ownerId);
        if (!entry || entry.selectionMessageId !== messageId) return undefined;
        // Consume before awaiting Telegram so double clicks cannot start two downloads.
        this.entries.delete(ownerId);
        return entry;
    }

    removeExpired() {
        for (const ownerId of this.entries.keys()) this.get(ownerId);
    }
}

module.exports = SelectionStore;
