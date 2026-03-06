const MessageCache = require('./messageCache.js');
const { buildLayout } = require('./layout.js');

let _layout = null;
let _cache  = null;
let _messageListener = null;
let _active = false;

const MAX_CACHED_MESSAGES = 500;

function activate(yuno, { onQuit } = {}) {
    if (_active) return;
    _active = true;

    const client     = yuno.dC;
    const commandMan = yuno.commandMan;

    _cache = new MessageCache();

    // Pause the standard REPL while TUI is active
    if (yuno.interactiveTerm?.listening) {
        yuno.interactiveTerm.stop();
    }

    _layout = buildLayout(client, yuno, commandMan, _cache);

    // Live message handler
    _messageListener = (message) => {
        const channelId = message.channelId;
        const activeId  = _layout.chatPane.box._getActiveChannelId();

        // Cap cache per channel to avoid unbounded growth
        const msgs = _cache.get(channelId);
        if (msgs.length >= MAX_CACHED_MESSAGES) msgs.shift();

        _cache.append(channelId, message);

        if (channelId === activeId) {
            _layout.chatPane.appendMessage(message, activeId);
        } else {
            _cache.incrementUnread(channelId);
            _layout.channelTree.refresh(client, _cache);
            _layout.statusBar._update(client, _cache);
        }
    };

    client.on('messageCreate', _messageListener);

    _layout.screen.on('tui-quit', () => {
        deactivate(yuno);
        if (onQuit) onQuit();
    });
}

function deactivate(yuno) {
    if (!_active) return;
    _active = false;

    if (_messageListener) {
        yuno.dC.removeListener('messageCreate', _messageListener);
        _messageListener = null;
    }

    if (_layout) {
        _layout.destroy();
        _layout = null;
    }

    _cache = null;

    // Restore REPL
    if (yuno.interactivity && yuno.interactiveTerm) {
        yuno.interactiveTerm.listen();
    }
}

function isActive() { return _active; }

module.exports = { activate, deactivate, isActive };
