const blessed = require('neo-blessed');
const { ChannelType } = require('discord.js');

function buildTreeItems(client, cache) {
    const items = [];

    for (const guild of client.guilds.cache.values()) {
        items.push({ label: `▼ ${guild.name}`, type: 'server', guild, channel: null });

        const channels = [...guild.channels.cache.values()]
            .filter(c =>
                c.type === ChannelType.GuildText ||
                c.type === ChannelType.GuildAnnouncement ||
                c.type === ChannelType.GuildForum
            )
            .sort((a, b) => a.position - b.position);

        for (const ch of channels) {
            const unread = cache.getUnread(ch.id);
            const badge  = unread > 0 ? ` {red-fg}[${unread}]{/red-fg}` : '';
            const bold   = unread > 0 ? '{bold}' : '';
            const boldEnd = unread > 0 ? '{/bold}' : '';
            items.push({
                label: `  ${bold}#${ch.name}${boldEnd}${badge}`,
                type: 'channel',
                guild,
                channel: ch,
                key: ch.id
            });
        }
    }

    items.push({ label: '─── DMs ───', type: 'divider' });
    return items;
}

function createChannelTree(screen) {
    const list = blessed.list({
        parent: screen,
        top: 1,
        left: 0,
        width: 22,
        bottom: 1,
        border: { type: 'line' },
        tags: true,
        keys: true,
        mouse: true,
        scrollable: true,
        style: {
            border: { fg: 'cyan' },
            selected: { bg: 'blue', fg: 'white' },
            item: { fg: 'white' }
        },
        label: ' Servers '
    });

    let _items = [];
    let _selectHandlers = [];

    function refresh(client, cache) {
        _items = buildTreeItems(client, cache);
        list.setItems(_items.map(i => i.label));
        screen.render();
    }

    list.on('select', (_, idx) => {
        const item = _items[idx];
        if (!item || item.type === 'server' || item.type === 'divider') return;
        for (const fn of _selectHandlers) fn(item);
    });

    function onSelect(fn) { _selectHandlers.push(fn); }

    return { list, refresh, onSelect };
}

module.exports = { createChannelTree, buildTreeItems };
