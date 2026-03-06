const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureLog, runCommand } = require('../../src/lib/tui/commandBridge.js');

test('captureLog captures console.log output', async () => {
    const lines = await captureLog(async () => {
        console.log('hello');
        console.log('world');
    });
    assert.deepEqual(lines, ['hello', 'world']);
});

test('captureLog restores console.log after sync throw', async () => {
    const orig = console.log;
    try {
        await captureLog(async () => { throw new Error('boom'); });
    } catch (e) { /* expected */ }
    assert.equal(console.log, orig);
});

test('runCommand returns error for unknown command', async () => {
    const fakeYuno = {};
    const fakeCommandMan = { commands: {} };
    const lines = await runCommand(fakeYuno, fakeCommandMan, 'notacommand arg1');
    assert.ok(lines[0].includes('Unknown command'));
});

test('runCommand captures output of known command', async () => {
    const fakeYuno = {};
    const fakeCommandMan = {
        commands: {
            ping: {
                runTerminal: async () => { console.log('pong'); }
            }
        }
    };
    const lines = await runCommand(fakeYuno, fakeCommandMan, 'ping');
    assert.deepEqual(lines, ['pong']);
});
