class MessageCache {
    constructor() {
        this._messages = new Map();
        this._unread   = new Map();
    }

    has(channelId) {
        return this._messages.has(channelId);
    }

    get(channelId) {
        return this._messages.get(channelId) || [];
    }

    set(channelId, messages) {
        this._messages.set(channelId, messages);
    }

    append(channelId, message) {
        if (!this._messages.has(channelId)) this._messages.set(channelId, []);
        this._messages.get(channelId).push(message);
    }

    incrementUnread(channelId) {
        this._unread.set(channelId, (this._unread.get(channelId) || 0) + 1);
    }

    clearUnread(channelId) {
        this._unread.delete(channelId);
    }

    getUnread(channelId) {
        return this._unread.get(channelId) || 0;
    }

    getTotalUnread() {
        let total = 0;
        for (const n of this._unread.values()) total += n;
        return total;
    }

    clear() {
        this._messages.clear();
        this._unread.clear();
    }
}

module.exports = MessageCache;
