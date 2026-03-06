const tuiController = require('../lib/tui/index.js');

module.exports.runTerminal = async function(yuno, args) {
    if (tuiController.isActive()) {
        console.log('TUI is already active. Press Ctrl+Q to exit.');
        return;
    }

    if (!yuno.dC?.isReady()) {
        console.log('Error: Bot is not connected to Discord yet.');
        return;
    }

    console.log('Starting TUI... (Ctrl+Q to exit)');

    tuiController.activate(yuno, {
        onQuit: () => {
            yuno.prompt.info('TUI exited. Back to REPL.');
        }
    });
};

module.exports.about = {
    command: 'tui',
    description: 'Launch the full terminal UI (XChat-style). Ctrl+Q to exit.',
    usage: 'tui',
    examples: ['tui'],
    discord: false,
    terminal: true,
    list: false,
    listTerminal: true,
    aliases: []
};
