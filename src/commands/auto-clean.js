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

const {TextChannel, EmbedBuilder} = require("discord.js")

// Handler object pattern for cleaner command routing
const subcommandHandlers = {
    async remove(yuno, ch, args, msg) {
        if (!(ch instanceof TextChannel))
            return msg.channel.send(":negative_squared_cross_mark: Please mention a channel.");

        const { database, dbCommands, intervalMan } = yuno;
        const clean = await dbCommands.getClean(database, ch.guild.id, ch.name);
        if (clean === null)
            return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have any auto-clean set up.");

        await dbCommands.delClean(database, ch.guild.id, ch.name);
        intervalMan.clear(`autocleaner-clean-${ch.guild.id}-${ch.name}`);
        return msg.channel.send(":white_check_mark: The auto-clean has been removed.");
    },

    async clean(yuno, ch, args, msg) {
        return yuno.commandMan.execute(yuno, msg.member, "clean <#dummy-id>", msg);
    },

    async reset(yuno, ch, args, msg) {
        if (!(ch instanceof TextChannel))
            return msg.channel.send(":negative_squared_cross_mark: Please mention a channel.");

        const { database, dbCommands } = yuno;
        const clean = await dbCommands.getClean(database, ch.guild.id, ch.name);

        if (clean === null)
            return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have any auto-clean set up.");

        const { timeFEachClean, timeBeforeClean } = clean;
        await dbCommands.setClean(database, ch.guild.id, ch.name, timeFEachClean, timeBeforeClean, timeFEachClean * 60);
        return msg.channel.send(":white_check_mark: Reset!");
    },

    async list(yuno, ch, args, msg) {
        const { database, dbCommands, UTIL } = yuno;

        if (ch instanceof TextChannel) {
            const clean = await dbCommands.getClean(database, ch.guild.id, ch.name);
            if (clean === null)
                return msg.channel.send(":negative_squared_cross_mark: The auto-clean doesn't exists.");

            const { timeFEachClean, timeBeforeClean, remainingTime } = clean;
            return msg.channel.send({embeds: [new EmbedBuilder()
                .setColor("#ff51ff")
                .setTitle(`#${ch.name} auto-clean configuration.`)
                .addFields([
                    {name: "Time between each clean", value: `${String(timeFEachClean).padStart(2, '0')}h`, inline: true},
                    {name: "Warning thrown at", value: `${UTIL.formatDuration(timeBeforeClean * 60)}remaining`, inline: true},
                    {name: "Remaining time before clean", value: `${UTIL.formatDuration(remainingTime * 60)}`, inline: true}
                ])]});
        }

        const cleans = await dbCommands.getCleans(database);
        const channels = cleans
            .filter(el => el.guildId === msg.guild.id)
            .map(el => `#${el.channelName}`);

        const message = channels.length === 0 ? "None." : `\`\`\` ${channels.join(", ")} \`\`\``;

        return msg.channel.send({embeds: [new EmbedBuilder()
            .setColor("#ff51ff")
            .setTitle("Channels having an auto-clean:")
            .setDescription(message)]});
    },

    async delay(yuno, ch, args, msg) {
        if (!(ch instanceof TextChannel))
            return msg.channel.send(":negative_squared_cross_mark: Please mention a channel.");

        const { database, dbCommands } = yuno;
        const clean = await dbCommands.getClean(database, ch.guild.id, ch.name);

        if (clean === null)
            return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have any auto-clean set up.");

        const { timeFEachClean, timeBeforeClean, remainingTime } = clean;
        await dbCommands.setClean(database, ch.guild.id, ch.name, timeFEachClean, timeBeforeClean, remainingTime + parseInt(args[1]));
        return msg.channel.send(`:white_check_mark: Delayed the clean from ${args[1]} minutes!`);
    },

    async addOrEdit(yuno, ch, args, msg) {
        if (!(ch instanceof TextChannel))
            return msg.channel.send("Please mention a channel.");

        const { database, dbCommands } = yuno;
        const isAddOrEdit = args[0] === "add" || args[0] === "edit";
        let betweenCleans = parseInt(isAddOrEdit ? args[2] : args[1]);
        let beforeWarning = parseInt(isAddOrEdit ? args[3] : args[2]);

        if (args[0] === "add") {
            const existing = await dbCommands.getClean(database, ch.guild.id, ch.name);
            if (existing !== null)
                return msg.channel.send(":negative_squared_cross_mark: The channel you asked to add an auto-clean already has an auto-clean.\nPlease use `auto-clean edit`.");
        }

        if (typeof betweenCleans !== "number" || typeof beforeWarning !== "number")
            return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

        const MAX_INTERVAL_MS = 2147483647;

        if (isNaN(betweenCleans) || isNaN(beforeWarning))
            return msg.channel.send("Between cleans or before warning argument isn't a number.");

        if (betweenCleans <= 0 || beforeWarning <= 0)
            return msg.channel.send("Between cleans and before warning cannot be negative or equal to 0.");

        if (betweenCleans * 60 * 60 * 1000 > MAX_INTERVAL_MS)
            return msg.channel.send(`Between cleans must be **less than ${Math.floor(MAX_INTERVAL_MS / (60*60*1000))}**.`);

        if (beforeWarning / 60 >= betweenCleans)
            return msg.channel.send("Before warning cannot be equal or higher than between cleans.");

        const [result] = await dbCommands.setClean(database, msg.guild.id, ch.name, betweenCleans, beforeWarning, null);
        const nicesentence = `<#${ch.id}> will be cleaned every ${betweenCleans} hours and a warning will be thrown ${beforeWarning} minutes before.`;

        yuno._refreshMod("auto-cleaner");

        return msg.channel.send(result === "creating"
            ? `Clean created!\n${nicesentence}`
            : `Clean updated!\n${nicesentence}`);
    }
};

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0)
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

    const ch = msg.mentions.channels.first();
    const subcommand = args[0];

    const handler = subcommandHandlers[subcommand];
    if (handler) {
        return handler(yuno, ch, args, msg);
    }

    // Default: add/edit behavior
    return subcommandHandlers.addOrEdit(yuno, ch, args, msg);
}

module.exports.about = {
    "command": "auto-clean",
    "description": "Adds an auto-clean for a channel.\nadd is to add a new auto-clean\nremove to delete an auto-clean\nedit to change the delays of an auto-clean\nreset to reset the counter of an a.-c.\nlist to lists all the actives auto-cleans",
    "usage": "auto-clean <add | remove | edit | reset | delay | list> [#channel] [time between cleans in hours | time in minutes to add (delay)] [time for the warning before the clean in minutes, number]",
    "examples": ["auto-clean #channel-mention 1 15 **adds by default**", "auto-clean add #channel-mention 2 15", "auto-clean list #channel"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "autoclean",
    "onlyMasterUsers": true
}