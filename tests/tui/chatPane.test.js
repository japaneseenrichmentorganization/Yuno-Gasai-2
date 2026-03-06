const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatMessage, formatEmbed } = require('../../src/lib/tui/chatPane.js');

test('formatMessage includes username and content', () => {
    const msg = {
        author: { username: 'Alice' },
        content: 'hello world',
        embeds: [],
        createdAt: new Date('2024-01-01T12:34:00Z')
    };
    const out = formatMessage(msg);
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('hello world'));
    assert.ok(out.includes('12:34'));
});

test('formatMessage renders embeds when content is empty', () => {
    const msg = {
        author: { username: 'Bot' },
        content: '',
        embeds: [{ title: 'My Title', description: 'Some desc' }],
        createdAt: new Date()
    };
    const out = formatMessage(msg);
    assert.ok(out.includes('[Embed: My Title'));
    assert.ok(out.includes('Some desc'));
});

test('formatEmbed with no description', () => {
    const out = formatEmbed({ title: 'Just Title', description: null });
    assert.ok(out.includes('Just Title'));
    assert.ok(!out.includes('null'));
});
