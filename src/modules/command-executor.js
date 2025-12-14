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

let workOnlyOnGuild = null,
    defaultPrefix = null,
    prefixes = null,
    dmMessage = null,

    discClient,
    Yuno,

    ONE_TIME_EVENT = false;

module.exports.modulename = "command-executor";

let msgEvent = (async function(msg) {
    if (msg.author.id === discClient.user.id)
        return;

    // Check if user or server is bot-banned
    try {
        const banStatus = await Yuno.dbCommands.isBotBanned(
            Yuno.database,
            msg.author.id,
            msg.guild?.id || null
        );

        if (banStatus.banned) {
            // Silently ignore messages from banned users/servers
            return;
        }
    } catch (e) {
        // If ban check fails, continue processing (fail open for commands)
    }

    // if message sent in DM
    if (!msg.guild) {
        let command = msg.content.substring(defaultPrefix.length);

        if (Yuno.commandMan.isDMCommand(command))
            return Yuno.commandMan.executeDM(Yuno, msg.author, command, msg);
        else
            return msg.reply((dmMessage !== null ? dmMessage : "I'm just a bot :'(. I can't answer to you.") + "\nYou can also send !source(s) to get the sources of the bot.");
    }

    if (typeof workOnlyOnGuild !== "undefined" && workOnlyOnGuild !== null && workOnlyOnGuild.id !== msg.guild.id)
        return;

    let msgCnt = msg.content,
        guildPrefix = prefixes[msg.guild.id];

    // switching to default prefix if guild
    if (guildPrefix === null || typeof guildPrefix === "undefined")
        guildPrefix = defaultPrefix;

    // Check if the bot is mentioned - trigger delay command
    if (msg.mentions.has(discClient.user) && !msg.mentions.everyone) {
        // Remove the mention and check if there's a command after it
        const mentionRegex = new RegExp(`<@!?${discClient.user.id}>`, 'g');
        const contentWithoutMention = msgCnt.replace(mentionRegex, '').trim();

        // If just a mention or mention with "delay"/"wait"/"hold", run delay command
        if (contentWithoutMention === '' ||
            contentWithoutMention.toLowerCase() === 'delay' ||
            contentWithoutMention.toLowerCase() === 'wait' ||
            contentWithoutMention.toLowerCase() === 'hold') {
            return Yuno.commandMan.execute(Yuno, msg.member, 'delay', msg);
        }
    }

    if (msgCnt.indexOf(guildPrefix) === 0) {
        let command = msgCnt.substring(guildPrefix.length);
        Yuno.commandMan.execute(Yuno, msg.member, command, msg);
    }
})

let discordConnected = async function(yuno) {
    discClient = yuno.dC;
    Yuno = yuno;

    prefixes = await Yuno.dbCommands.getPrefixes(Yuno.database);

    // the workOnlyOnGuild future value (if the bot has joined the guild)
    let workOnlyOnGuild_ = discClient.guilds.cache.get(workOnlyOnGuild);

    if (workOnlyOnGuild_ !== null)
        workOnlyOnGuild = workOnlyOnGuild_

    if (!ONE_TIME_EVENT)
        discClient.on("messageCreate", msgEvent)

    ONE_TIME_EVENT = true;
}

module.exports.init = function(Yuno, hotReloaded) {
    if (hotReloaded)
        discordConnected(Yuno)
    else
        Yuno.on("discord-connected", discordConnected)
}

module.exports.configLoaded = function(Yuno, config) {
    const workOnlyOnGuild_ = config.get("debug.work-only-on-guild");
    const defaultPrefix_ = config.get("commands.default-prefix");
    const dmMessage_ = config.get("chat.dm");

    // Use nullish coalescing with type guard
    workOnlyOnGuild = typeof workOnlyOnGuild_ === "string" ? workOnlyOnGuild_ : workOnlyOnGuild;
    defaultPrefix = typeof defaultPrefix_ === "string" ? defaultPrefix_ : defaultPrefix;
    dmMessage = typeof dmMessage_ === "string" ? dmMessage_ : dmMessage;
}

module.exports.beforeShutdown = function(Yuno) {
    if (discClient) {
        discClient.removeListener("messageCreate", msgEvent);
    }
    ONE_TIME_EVENT = false;
}
