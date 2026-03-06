const blessed = require('neo-blessed');

function createStatusBar(screen) {
    const bar = blessed.box({
        parent: screen,
        top: 0,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: {
            bg: 'blue',
            fg: 'white',
            bold: true
        }
    });

    let _pingInterval = null;

    function update(client, cache) {
        const tag  = client?.user?.tag || 'Connecting...';
        const ping = client?.ws?.ping != null ? `${Math.round(client.ws.ping)}ms` : '---';
        const servers = client?.guilds?.cache?.size ?? 0;
        const unread = cache ? cache.getTotalUnread() : 0;
        const unreadStr = unread > 0 ? ` {red-fg}[${unread} unread]{/red-fg}` : '';
        bar.setContent(` {bold}Yuno{/bold}  ${tag}  Servers: ${servers}  Ping: ${ping}${unreadStr}`);
        screen.render();
    }

    function startPingLoop(client, cache) {
        update(client, cache);
        _pingInterval = setInterval(() => update(client, cache), 30_000);
    }

    function destroy() {
        if (_pingInterval) clearInterval(_pingInterval);
    }

    bar._update = update;
    bar._startPingLoop = startPingLoop;
    bar._destroy = destroy;

    return bar;
}

module.exports = { createStatusBar };
