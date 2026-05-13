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

// ---------------------------------------------------------------------------
// DM exploit / probing detection
//
// All checks use String.prototype.includes() on lowercased input — O(n*k) with
// no regex engine and therefore no catastrophic backtracking risk.
//
// Design notes (state-actor threat model):
//  • Only non-master users are subject to auto-ban; master users can legitimately
//    discuss these topics or test the bot.
//  • We do not warn the user before banning — doing so confirms detection worked
//    and gives an attacker a signal to tune their payload.
//  • Failure to persist the ban is logged but never surfaces to the sender.
//  • The list is conservative: markers that can plausibly appear in benign DMs
//    (e.g. "exec(" alone) are not included; only unambiguous injection vocabulary
//    or explicit master-only command invocations qualify.
// ---------------------------------------------------------------------------

// Strings that appear exclusively in code-execution payloads, not normal chat.
const CODE_INJECTION_MARKERS = [
    "eval(",
    "new function(",
    "child_process",
    "execsync(",
    "execfile(",
    "node:fs",
    "node:child",
    "process.env",
    "process.exit(",
    "process.kill(",
    "process.mainmodule",
    "__proto__[",
    "__proto__=",
    "constructor.prototype",
    "global.process",
    "import('fs",
    'import("fs',
    "import('child",
    'import("child',
];

// Master-only commands that a regular user should never attempt via DM.
// Trying them signals deliberate probing rather than accidental use.
const MASTER_ONLY_DM_COMMANDS = new Set([
    "eval", "hot-reload", "shutdown", "db-encrypt", "debug-error",
    "drop-errors-on", "add-masteruser", "config", "exec",
    "init-guild", "bot-ban", "importbans", "scan-alts",
]);

/**
 * Returns true if the DM content looks like an exploit or privilege-probing
 * attempt.  All checks are done with plain string operations (no regex).
 * @param {string} content
 * @param {string|null} prefix  The guild's effective command prefix
 */
function detectExploitAttempt(content, prefix) {
    if (!content || typeof content !== "string") return false;
    const lower = content.toLowerCase();

    for (const marker of CODE_INJECTION_MARKERS) {
        if (lower.includes(marker)) return true;
    }

    // Detect explicit invocation of master-only commands via DM.
    if (prefix && lower.startsWith(prefix.toLowerCase())) {
        const cmd = lower.substring(prefix.length).trim().split(/\s+/)[0];
        if (MASTER_ONLY_DM_COMMANDS.has(cmd)) return true;
    }

    return false;
}

let msgEvent = (async function(msg) {
    if (msg.author.id === discClient.user.id)
        return;

    // Check if user or server is bot-banned.
    // Fail CLOSED: if the ban-list lookup fails for any reason (database unavailable,
    // transient error, deliberate disruption) we deny the request rather than allowing
    // a banned user to bypass the list during an outage.
    try {
        const banStatus = await Yuno.dbCommands.isBotBanned(
            Yuno.database,
            msg.author.id,
            msg.guild?.id || null
        );

        if (banStatus.banned) {
            return;
        }
    } catch (e) {
        return; // deny on uncertainty
    }

    // if message sent in DM
    if (!msg.guild) {
        const isMaster = Yuno.commandMan._isUserMaster(msg.author.id);

        // Exploit / probing detection — auto-bot-ban before any further processing.
        if (!isMaster && detectExploitAttempt(msg.content, defaultPrefix)) {
            const snippet = msg.content.substring(0, 120).replace(/\n/g, " ");
            console.warn(
                `[SECURITY] Auto-bot-banning ${msg.author.tag ?? msg.author.id} ` +
                `(${msg.author.id}) — DM exploit attempt. Snippet: ${snippet}`
            );
            try {
                await Yuno.dbCommands.addBotBan(
                    Yuno.database,
                    msg.author.id,
                    "user",
                    "Automated: DM exploit/probing attempt detected",
                    "system"
                );
            } catch (banErr) {
                console.error(`[SECURITY] Failed to persist bot-ban for ${msg.author.id}:`, banErr.message);
            }
            return; // silently drop — do not confirm detection to sender
        }

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

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded)
        await discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected);
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
