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

const EmbedCmdResponse = require("../lib/EmbedCmdResponse"),
    {EmbedBuilder} = require("discord.js");

function listMainCommands(yuno, isTerminal, member) {
    const { commandMan } = yuno;
    const commands = Object.values(commandMan.commands);
    const keys = Object.keys(commandMan.commands);
    const ret = [];

    for (let i = 0; i < commands.length; i++) {
        const { about } = commands[i];

        if (about.listTerminal === false && isTerminal)
            continue;

        if (about.list === false && !isTerminal)
            continue;

        // removing aliases
        if (about.command !== keys[i])
            continue;

        if (!isTerminal) {
            const isUM = commandMan._isUserMaster(member.id);

            if (!isUM && about.onlyMasterUsers === true)
                continue;

            if (!isUM && !commandMan._hasPermissions(member, about.requiredPermissions))
                continue;
        }

        ret.push(keys[i]);
    }

    return ret.join(", ");
}

function helpOnACommand(command, yuno, msg) {
    const { commandMan, prompt } = yuno;
    const isTerminal = !msg;

    if (!commandMan._commandExists(command)) {
        const errorMsg = `The command ${command} doesn't exists.`;
        return isTerminal ? prompt.error(errorMsg) : msg.channel.send(errorMsg);
    }

    const cmd = commandMan.commands[command];
    const {
        command: commandName,
        aliases,
        usage,
        examples,
        description,
        requiredPermissions,
        discord: usableOnDiscord,
        terminal: usableOnTerminal,
        list: listedOnDiscord,
        listTerminal: listedOnTerminal,
        onlyMasterUsers
    } = cmd.about;
    let aliasesCopy = aliases;
    let examplesCopy = examples;
    let requiredPermsCopy = requiredPermissions;

    const defaulter = (value, ret) => typeof value !== "boolean" ? (typeof ret === "boolean" ? ret : true) : value;

    if ((listedOnDiscord === false || usableOnDiscord === false) && !isTerminal)
        return msg.channel.send(`The command ${commandName} doesn't exists.`);

    if (isTerminal) {
        if (listedOnTerminal === false && usableOnTerminal === false)
            prompt.warn(`Command ${commandName} is not usable & not listed in terminal.`);
        else if (listedOnTerminal === false)
            prompt.warn(`Command ${commandName} not listed in terminal.`);
        else if (usableOnTerminal === false)
            prompt.warn(`Command ${commandName} is not usable in terminal`);

        const lines = [`Command name: ${commandName}`];

        if (aliasesCopy) {
            if (Array.isArray(aliasesCopy) && aliasesCopy.length > 1)
                lines.push(`Aliases: ${aliasesCopy.join(",")}`);
            else {
                const aliasStr = Array.isArray(aliasesCopy) ? aliasesCopy[0] : aliasesCopy;
                if (typeof aliasStr === "string") lines.push(`Alias: ${aliasStr}`);
            }
        } else {
            lines.push("Aliases: None");
        }

        if (typeof description === "string") lines.push(`Description: ${description}`);
        if (typeof usage === "string") lines.push(`Usage: ${usage}`);

        if (examplesCopy) {
            if (Array.isArray(examplesCopy) && examplesCopy.length > 1)
                lines.push(`Examples: ${examplesCopy.join(",")}`);
            else {
                const exStr = Array.isArray(examplesCopy) ? examplesCopy[0] : examplesCopy;
                if (typeof exStr === "string") lines.push(`Examples: ${exStr}`);
            }
        } else {
            lines.push("Examples: None");
        }

        if (requiredPermsCopy) {
            if (Array.isArray(requiredPermsCopy) && requiredPermsCopy.length > 1)
                lines.push(`Required permissions: ${requiredPermsCopy.join(",")}`);
            else {
                const permStr = Array.isArray(requiredPermsCopy) ? requiredPermsCopy[0] : requiredPermsCopy;
                if (typeof permStr === "string") lines.push(`Required permission: ${permStr}`);
            }
        } else {
            lines.push("Required permissions: None");
        }

        lines.push(`Usable on discord: ${defaulter(usableOnDiscord)}`);
        lines.push(`Usable on terminal: ${defaulter(usableOnTerminal)}`);
        lines.push(`Listed on discord (through help/list): ${defaulter(listedOnDiscord)}`);
        lines.push(`Listed on terminal: ${defaulter(listedOnTerminal)}`);
        lines.push(`Usable only by master users: ${defaulter(onlyMasterUsers, false)}`);

        for (const line of lines) prompt.info(line);
        return;
    }

    const response = new EmbedBuilder()
        .setColor("#42d1f4")
        .addFields([{name: "Command name", value: commandName, inline: true}]);

    EmbedCmdResponse.setCMDRequester(response, msg.member);

    if (Array.isArray(aliasesCopy)) {
        if (aliasesCopy.length === 1)
            response.addFields([{name: "Alias", value: aliasesCopy[0], inline: true}]);
        else
            response.addFields([{name: "Aliases", value: aliasesCopy.join(", "), inline: true}]);
    } else if (typeof aliasesCopy === "string") {
        response.addFields([{name: "Alias", value: aliasesCopy, inline: true}]);
    }

    if (typeof usage === "string")
        response.addFields([{name: "Usage", value: usage, inline: true}]);

    if (typeof description === "string")
        response.addFields([{name: "Description", value: description}]);

    if (Array.isArray(examplesCopy)) {
        if (examplesCopy.length === 1)
            response.addFields([{name: "Example", value: examplesCopy[0], inline: true}]);
        else
            response.addFields([{name: "Examples", value: examplesCopy.join(", "), inline: true}]);
    } else if (typeof examplesCopy === "string") {
        response.addFields([{name: "Example", value: examplesCopy, inline: true}]);
    }

    return msg.channel.send({embeds: [response]});
}

/*
    List commands
*/
module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0 || args[0].trim() === "")
        if (author !== 0) {
            let response = new EmbedCmdResponse();
            response.setColor("#ff51ff")
                .setTitle("Little help about the commands.")
                .setDescription("`" + listMainCommands(yuno, false, msg.member) + "`")
                .setCMDRequester(msg.member);
            msg.channel.send({embeds: [response]});
        } else
            return yuno.prompt.info("The available commands are :\n    " + listMainCommands(yuno, true))
    else
        helpOnACommand(args[0].trim().toLowerCase(), yuno, msg);

}

module.exports.about = {
    "command": "list",
    "description": "Lists the commands",
    "discord": true,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "examples": "help anothercommand",
    "requiredPermissions": [],
    "aliases": ["help"]
}