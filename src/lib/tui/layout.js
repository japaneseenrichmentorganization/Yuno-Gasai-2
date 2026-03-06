const blessed = require('neo-blessed');
const { createStatusBar }   = require('./statusBar.js');
const { createHintBar }     = require('./hintBar.js');
const { createChannelTree } = require('./channelTree.js');
const { createChatPane }    = require('./chatPane.js');
const { createInputBar }    = require('./inputBar.js');
const { createMembersPane } = require('./membersPane.js');

const SHORTCUTS_TEXT = [
    '',
    '  ┌─────────────────────────────────────┐',
    '  │           Yuno TUI Shortcuts        │',
    '  ├─────────────────────────────────────┤',
    '  │  Tab          Cycle focus           │',
    '  │  ↑ / ↓       Navigate tree/history │',
    '  │  Space        Expand/collapse server│',
    '  │  Enter        Open channel / send   │',
    '  │  PgUp/PgDn    Scroll chat history   │',
    '  │  Esc          Focus sidebar         │',
    '  │  Alt+M        Toggle members list   │',
    '  │  Alt+H        Toggle hint bar       │',
    '  │  Ctrl+Q       Exit TUI              │',
    '  │  :command     Run bot command       │',
    '  │  :shortcuts   Show this overlay     │',
    '  └─────────────────────────────────────┘',
    '       Press any key to dismiss',
    ''
].join('\n');

function buildLayout(client, yuno, commandMan, cache) {
    const screen = blessed.screen({
        smartCSR: true,
        title: 'Yuno TUI',
        fullUnicode: true
    });

    // Widgets (no hintBarVisible parameter — layout handles resizing itself)
    const statusBar   = createStatusBar(screen);
    const hintBar     = createHintBar(screen);
    const channelTree = createChannelTree(screen);
    const chatPane    = createChatPane(screen);
    const inputBar    = createInputBar(screen);
    const membersPane = createMembersPane(screen);

    // Shortcuts overlay
    const shortcutsBox = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        width: 45,
        height: 20,
        content: SHORTCUTS_TEXT,
        border: { type: 'line' },
        hidden: true,
        style: {
            border: { fg: 'yellow' },
            bg: 'black',
            fg: 'white'
        }
    });

    // Command output overlay
    const cmdOverlay = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        width: '70%',
        height: '60%',
        scrollable: true,
        border: { type: 'line' },
        hidden: true,
        label: ' Command Output (any key to close) ',
        style: {
            border: { fg: 'green' },
            bg: 'black',
            fg: 'white'
        }
    });

    // Active channel state
    let activeChannel = null;

    // Command output display
    function showCmdOutput(lines) {
        cmdOverlay.setContent(lines.join('\n'));
        cmdOverlay.show();
        screen.render();
        screen.once('keypress', () => {
            cmdOverlay.hide();
            screen.render();
            inputBar.box.focus();
        });
    }

    // Channel/DM selection
    channelTree.onSelect(async (item) => {
        activeChannel = item.channel;
        cache.clearUnread(item.channel.id);
        channelTree.refresh(client, cache);
        statusBar._update(client, cache);
        await chatPane.setChannel(item.channel, cache);
        inputBar.setContext(item.channel, yuno, commandMan, cache, showCmdOutput);
        membersPane.refresh(item.channel);
        inputBar.box.focus();
    });

    // Shortcuts overlay
    screen.on('show-shortcuts', () => {
        shortcutsBox.show();
        screen.render();
        screen.once('keypress', () => {
            shortcutsBox.hide();
            screen.render();
            inputBar.box.focus();
        });
    });

    // Hint bar toggle — adjust widget bottom values dynamically
    screen.on('hint-bar-toggled', (visible) => {
        const bottomVal = visible ? 1 : 0;
        channelTree.list.bottom = bottomVal;
        chatPane.box.bottom     = visible ? 4 : 3;  // 3 for input bar height
        inputBar.box.bottom     = bottomVal;
        membersPane.list.bottom = bottomVal;
        screen.render();
    });

    // Global key bindings
    screen.key(['C-q'], () => screen.emit('tui-quit'));
    screen.key(['M-h'], () => hintBar.toggle());
    screen.key(['M-m'], () => {
        membersPane.toggle();
        if (activeChannel) membersPane.refresh(activeChannel);
    });
    screen.key(['tab'], () => {
        if (channelTree.list.focused) {
            inputBar.box.focus();
        } else {
            channelTree.list.focus();
        }
        screen.render();
    });
    screen.key(['escape'], () => {
        channelTree.list.focus();
        screen.render();
    });

    // Startup
    statusBar._startPingLoop(client, cache);
    channelTree.refresh(client, cache);
    channelTree.list.focus();
    screen.render();

    return {
        screen,
        statusBar,
        hintBar,
        channelTree,
        chatPane,
        inputBar,
        membersPane,
        showCmdOutput,
        destroy() {
            statusBar._destroy();
            screen.destroy();
        }
    };
}

module.exports = { buildLayout };
