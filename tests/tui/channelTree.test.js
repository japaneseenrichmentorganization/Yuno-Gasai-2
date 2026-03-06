const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTreeItems } = require('../../src/lib/tui/channelTree.js');
const { ChannelType } = require('discord.js');

function makeClient(guilds) {
    return { guilds: { cache: { values: () => guilds.values() } } };
}

function makeGuild(name, channels) {
    return { name, channels: { cache: { values: () => channels.values() } } };
}

const fakeCache = { getUnread: () => 0 };

test('server header appears before channels', () => {
    const ch = { name: 'general', type: ChannelType.GuildText, position: 0, id: '1' };
    const guild = makeGuild('My Server', [ch]);
    const items = buildTreeItems(makeClient([guild]), fakeCache);
    assert.equal(items[0].type, 'server');
    assert.ok(items[0].label.includes('My Server'));
    assert.equal(items[1].type, 'channel');
    assert.ok(items[1].label.includes('general'));
});

test('non-text channels are excluded', () => {
    const voice = { name: 'Voice', type: ChannelType.GuildVoice, position: 0, id: '2' };
    const guild = makeGuild('Test', [voice]);
    const items = buildTreeItems(makeClient([guild]), fakeCache);
    assert.equal(items.filter(i => i.type === 'channel').length, 0);
});

test('unread count appears in badge', () => {
    const ch = { name: 'alerts', type: ChannelType.GuildText, position: 0, id: '99' };
    const guild = makeGuild('G', [ch]);
    const cacheWithUnread = { getUnread: (id) => id === '99' ? 3 : 0 };
    const items = buildTreeItems(makeClient([guild]), cacheWithUnread);
    const channelItem = items.find(i => i.type === 'channel');
    assert.ok(channelItem.label.includes('[3]'));
});

test('DMs divider is last item', () => {
    const guild = makeGuild('G', []);
    const items = buildTreeItems(makeClient([guild]), fakeCache);
    assert.equal(items[items.length - 1].type, 'divider');
});
