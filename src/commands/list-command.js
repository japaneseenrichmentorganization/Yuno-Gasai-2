/*
    Yuno Gasai. A Discord.JS based bot, with multiple features.
    Copyright (C) 2018 Maeeen <maeeennn@gmail.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see https://www.gnu.org/licenses/.
*/

module.exports.runTerminal = async function(yuno, args) {
    let commands = yuno.commandMan.commands;
    let uniqueCommands = {};
    let terminalCommands = [];
    let discordCommands = [];
    let bothCommands = [];

    // Get unique commands (avoid showing aliases multiple times)
    for (let [name, cmd] of Object.entries(commands)) {
        if (!uniqueCommands[cmd.about.command]) {
            uniqueCommands[cmd.about.command] = cmd;
        }
    }

    // Categorize commands
    for (let [name, cmd] of Object.entries(uniqueCommands)) {
        let about = cmd.about;
        let isTerminal = about.terminal !== false;
        let isDiscord = about.discord === true;

        // Handle examples that might be a string or array
        let examples = about.examples || [];
        if (typeof examples === 'string') {
            examples = [examples];
        }

        let commandInfo = {
            name: about.command,
            description: about.description || "No description",
            aliases: about.aliases || [],
            masterOnly: about.onlyMasterUsers === true,
            usage: about.usage || about.command,
            examples: examples
        };

        if (isTerminal && isDiscord) {
            bothCommands.push(commandInfo);
        } else if (isTerminal) {
            terminalCommands.push(commandInfo);
        } else if (isDiscord) {
            discordCommands.push(commandInfo);
        }
    }

    // Sort alphabetically
    terminalCommands.sort((a, b) => a.name.localeCompare(b.name));
    bothCommands.sort((a, b) => a.name.localeCompare(b.name));
    discordCommands.sort((a, b) => a.name.localeCompare(b.name));

    // Display terminal-only commands
    if (terminalCommands.length > 0) {
        yuno.prompt.info("=== TERMINAL ONLY COMMANDS ===");
        terminalCommands.forEach(cmd => {
            let aliasStr = '';
            if (cmd.aliases.length > 0) {
                let aliases = Array.isArray(cmd.aliases) ? cmd.aliases : [cmd.aliases];
                aliasStr = ` (aliases: ${aliases.join(', ')})`;
            }
            let masterStr = cmd.masterOnly ? ' [MASTER ONLY]' : '';
            yuno.prompt.info(`  ${cmd.name}${aliasStr}${masterStr}`);
            yuno.prompt.info(`    ${cmd.description}`);
            if (cmd.usage !== cmd.name) {
                yuno.prompt.info(`    Usage: ${cmd.usage}`);
            }
            if (cmd.examples.length > 0) {
                yuno.prompt.info(`    Examples: ${cmd.examples.join(', ')}`);
            }
            console.log('');
        });
    }

    // Display commands available in both
    if (bothCommands.length > 0) {
        yuno.prompt.info("=== TERMINAL & DISCORD COMMANDS ===");
        bothCommands.forEach(cmd => {
            let aliasStr = '';
            if (cmd.aliases.length > 0) {
                let aliases = Array.isArray(cmd.aliases) ? cmd.aliases : [cmd.aliases];
                aliasStr = ` (aliases: ${aliases.join(', ')})`;
            }
            let masterStr = cmd.masterOnly ? ' [MASTER ONLY]' : '';
            yuno.prompt.info(`  ${cmd.name}${aliasStr}${masterStr}`);
            yuno.prompt.info(`    ${cmd.description}`);
            if (cmd.usage !== cmd.name) {
                yuno.prompt.info(`    Usage: ${cmd.usage}`);
            }
            if (cmd.examples.length > 0) {
                yuno.prompt.info(`    Examples: ${cmd.examples.join(', ')}`);
            }
            console.log('');
        });
    }

    // Summary
    yuno.prompt.success(`Total: ${terminalCommands.length} terminal-only, ${bothCommands.length} available in both, ${discordCommands.length} Discord-only`);
    yuno.prompt.info(`Total commands loaded: ${Object.keys(uniqueCommands).length}`);
}

module.exports.run = async function(yuno, author, args, msg) {
    // This is for Discord usage
    let commands = yuno.commandMan.commands;
    let uniqueCommands = {};
    let terminalCommands = [];
    let discordCommands = [];
    let bothCommands = [];

    // Get unique commands
    for (let [name, cmd] of Object.entries(commands)) {
        if (!uniqueCommands[cmd.about.command]) {
            uniqueCommands[cmd.about.command] = cmd;
        }
    }

    // Categorize
    for (let [name, cmd] of Object.entries(uniqueCommands)) {
        let about = cmd.about;
        let isTerminal = about.terminal !== false;
        let isDiscord = about.discord === true;

        if (isTerminal && isDiscord) {
            bothCommands.push(about.command);
        } else if (isTerminal) {
            terminalCommands.push(about.command);
        } else if (isDiscord) {
            discordCommands.push(about.command);
        }
    }

    let response = `**Available Commands**\n\n`;
    response += `**Discord Commands (${discordCommands.length + bothCommands.length}):** ${[...discordCommands, ...bothCommands].sort().join(', ')}\n\n`;
    response += `**Terminal Commands (${terminalCommands.length + bothCommands.length}):** ${[...terminalCommands, ...bothCommands].sort().join(', ')}\n\n`;
    response += `Total: ${Object.keys(uniqueCommands).length} unique commands`;

    return msg.channel.send(response);
}

module.exports.about = {
    "command": "list-commands",
    "description": "Lists all available commands with their descriptions, usage, and examples.",
    "usage": "list-commands",
    "examples": ["list-commands"],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "aliases": ["commands", "cmds", "help-all"],
    "onlyMasterUsers": false
}
