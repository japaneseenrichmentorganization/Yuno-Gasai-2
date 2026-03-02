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

const { EmbedBuilder } = require("discord.js");
const { AltDetector } = require("discord-alt-detector");

module.exports.modulename = "alt-detector";

const detector = new AltDetector();

// Suspicion category → config field name mapping
const CATEGORY_TO_FIELD = {
    "newbie": "actionNewbie",
    "suspicious": "actionSuspicious",
    "highly-suspicious": "actionHighlySuspicious",
    "mega-suspicious": "actionMegaSuspicious"
};

// Color per severity
const CATEGORY_COLORS = {
    "newbie": "#ffa500",
    "suspicious": "#ff6600",
    "highly-suspicious": "#ff3300",
    "mega-suspicious": "#cc0000"
};

let DISCORD_EVENTED = false,
    discClient = null,
    memberAddHandler = null;

async function applyAction(action, member, category, score, config) {
    const reason = `Alt account detected — category: ${category}, score: ${score}`;

    if (action === "kick") {
        try { await member.kick(reason); } catch (e) { console.error("[AltDetector] Failed to kick:", e.message); }
    } else if (action === "ban") {
        try { await member.ban({ deleteMessageSeconds: 0, reason }); } catch (e) { console.error("[AltDetector] Failed to ban:", e.message); }
    } else if (action === "role") {
        if (!config.quarantineRoleId) {
            console.warn("[AltDetector] Action is 'role' but no quarantineRoleId configured for guild", member.guild.id);
            return;
        }
        try {
            const role = await member.guild.roles.fetch(config.quarantineRoleId);
            if (role) await member.roles.add(role, reason);
        } catch (e) { console.error("[AltDetector] Failed to assign quarantine role:", e.message); }
    }
}

async function postToLogChannel(logChannelId, member, category, score, guild) {
    try {
        const channel = await guild.channels.fetch(logChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(CATEGORY_COLORS[category] || "#ff6600")
            .setTitle(`:warning: Possible Alt Account Detected`)
            .setDescription(`**${member.user.tag}** (ID: \`${member.user.id}\`) joined and was flagged.`)
            .addFields(
                { name: "Suspicion Category", value: category, inline: true },
                { name: "Score", value: String(score), inline: true },
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error("[AltDetector] Failed to post to log channel:", e.message);
    }
}

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;

    if (!DISCORD_EVENTED) {
        memberAddHandler = async function(member) {
            try {
                const config = await Yuno.dbCommands.getAltDetectorConfig(Yuno.database, member.guild.id);
                if (!config || !config.enabled) return;

                const result = detector.check(member);
                const category = detector.getCategory(result);
                const score = result.total;

                const actionField = CATEGORY_TO_FIELD[category];
                if (!actionField) return; // trusted/normal/highly-trusted — no action

                const action = config[actionField] || "none";
                if (action === "none") return;

                // Always log to the log channel if one is set (regardless of action type)
                if (config.logChannelId) {
                    await postToLogChannel(config.logChannelId, member, category, score, member.guild);
                }

                // Apply the configured action (log-only means posting to log channel, already done above)
                if (action !== "log") {
                    await applyAction(action, member, category, score, config);
                }
            } catch (e) {
                console.error("[AltDetector] Error in guildMemberAdd handler:", e.message);
            }
        };

        discClient.on("guildMemberAdd", memberAddHandler);
    }

    DISCORD_EVENTED = true;
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded)
        await discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected);
};

module.exports.configLoaded = function() {};

module.exports.beforeShutdown = function(Yuno) {
    if (discClient && memberAddHandler) {
        discClient.removeListener("guildMemberAdd", memberAddHandler);
    }
    DISCORD_EVENTED = false;
    memberAddHandler = null;
};
