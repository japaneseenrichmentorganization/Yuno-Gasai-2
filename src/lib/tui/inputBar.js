const blessed = require('neo-blessed');
const { runCommand } = require('./commandBridge.js');

const MAX_HISTORY = 50;

function createInputBar(screen) {
    const box = blessed.textbox({
        parent: screen,
        bottom: 1,
        left: 22,
        right: 0,
        height: 3,
        border: { type: 'line' },
        keys: true,
        mouse: true,
        inputOnFocus: true,
        style: {
            border: { fg: 'cyan' },
            focus: { border: { fg: 'yellow' } }
        },
        label: ' Input '
    });

    const history = [];
    let historyIdx = -1;
    let _channel = null;
    let _yuno    = null;
    let _commandMan = null;
    let _onCommand = null;

    function setContext(channel, yuno, commandMan, cache, onCommandOutput) {
        _channel    = channel;
        _yuno       = yuno;
        _commandMan = commandMan;
        _onCommand  = onCommandOutput;
        box.setLabel(` [#${channel.name}] `);
        screen.render();
    }

    function pushHistory(text) {
        history.unshift(text);
        if (history.length > MAX_HISTORY) history.pop();
        historyIdx = -1;
    }

    box.key(['up'], () => {
        if (history.length === 0) return;
        historyIdx = Math.min(historyIdx + 1, history.length - 1);
        box.setValue(history[historyIdx]);
        screen.render();
    });

    box.key(['down'], () => {
        if (historyIdx <= 0) {
            historyIdx = -1;
            box.setValue('');
        } else {
            historyIdx--;
            box.setValue(history[historyIdx]);
        }
        screen.render();
    });

    box.on('submit', async (value) => {
        const text = (value || '').trim();
        box.clearValue();
        screen.render();

        if (!text) return;
        pushHistory(text);

        if (text.startsWith(':')) {
            const cmdInput = text.slice(1).trim();
            if (!cmdInput) return;
            if (cmdInput === 'shortcuts') {
                screen.emit('show-shortcuts');
                return;
            }
            const lines = await runCommand(_yuno, _commandMan, cmdInput);
            if (_onCommand) _onCommand(lines);
        } else {
            if (!_channel) return;
            try {
                await _channel.send(text);
            } catch (e) {
                if (_onCommand) _onCommand([`Error sending: ${e.message}`]);
            }
        }

        box.focus();
    });

    return { box, setContext };
}

module.exports = { createInputBar };
