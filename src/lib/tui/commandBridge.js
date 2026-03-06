async function captureLog(fn) {
    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.map(String).join(' '));
    try {
        await fn();
    } finally {
        console.log = orig;
    }
    return lines;
}

async function runCommand(yuno, commandMan, rawInput) {
    const parts = rawInput.trim().split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    const cmd = commandMan.commands[cmdName];
    if (!cmd || typeof cmd.runTerminal !== 'function') {
        return [`Unknown command: ${cmdName}. Type :list for available commands.`];
    }

    return captureLog(() => cmd.runTerminal(yuno, args, rawInput, null));
}

module.exports = { captureLog, runCommand };
