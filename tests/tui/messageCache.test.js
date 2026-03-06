const { test } = require('node:test');
const assert = require('node:assert/strict');
const MessageCache = require('../../src/lib/tui/messageCache.js');

test('has() returns false for unknown channel', () => {
    const c = new MessageCache();
    assert.equal(c.has('123'), false);
});

test('set() and get() round-trip', () => {
    const c = new MessageCache();
    c.set('123', [{ id: '1', content: 'hi' }]);
    assert.equal(c.get('123').length, 1);
    assert.equal(c.get('123')[0].content, 'hi');
});

test('get() returns empty array for unknown channel', () => {
    const c = new MessageCache();
    assert.deepEqual(c.get('unknown'), []);
});

test('append() adds to existing cache', () => {
    const c = new MessageCache();
    c.set('123', []);
    c.append('123', { id: '2', content: 'world' });
    assert.equal(c.get('123').length, 1);
});

test('append() creates entry if channel not cached', () => {
    const c = new MessageCache();
    c.append('456', { id: '3', content: 'new' });
    assert.equal(c.get('456').length, 1);
});

test('unread: incrementUnread and getUnread', () => {
    const c = new MessageCache();
    c.incrementUnread('123');
    c.incrementUnread('123');
    assert.equal(c.getUnread('123'), 2);
});

test('unread: clearUnread resets to 0', () => {
    const c = new MessageCache();
    c.incrementUnread('123');
    c.clearUnread('123');
    assert.equal(c.getUnread('123'), 0);
});

test('unread: getTotalUnread sums all channels', () => {
    const c = new MessageCache();
    c.incrementUnread('aaa');
    c.incrementUnread('aaa');
    c.incrementUnread('bbb');
    assert.equal(c.getTotalUnread(), 3);
});

test('clear() wipes all data', () => {
    const c = new MessageCache();
    c.set('123', [{ id: '1' }]);
    c.incrementUnread('123');
    c.clear();
    assert.equal(c.has('123'), false);
    assert.equal(c.getTotalUnread(), 0);
});
