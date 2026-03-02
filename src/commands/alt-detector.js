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

delete require.cache[require.resolve("../lib/EmbedCmdResponse")];
const EmbedCmdResponse = require("../lib/EmbedCmdResponse");

const VALID_LEVELS = ["newbie", "suspicious", "highly-suspicious", "mega-suspicious"];
const VALID_ACTIONS = ["none", "log", "kick", "ban", "role"];

const LEVEL_TO_FIELD = {
    "newbie": "actionNewbie",
    "suspicious": "actionSuspicious",
    "highly-suspicious": "actionHighlySuspicious",
    "mega-suspicious": "actionMegaSuspicious"
};

module.exports.run = async function(yuno, author, args, msg) {
    const sub = args[0]?.toLowerCase();

    if (!sub) {
        return msg.channel.send("Usage: `.alt-detector <enable|disable|setchannel|setrole|setaction|status>`");
    }

    const guildId = msg.guild.id;

    if (sub === "enable") {
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "enabled", 1);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Alt Detector Enabled")
            .setDescription("Alt detection is now **enabled** for this server. New members will be scored on join.")
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "disable") {
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "enabled", 0);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#ff6600")
            .setTitle(":octagonal_sign: Alt Detector Disabled")
            .setDescription("Alt detection is now **disabled** for this server.")
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "setchannel") {
        const channel = msg.mentions.channels.first() || (args[1] ? msg.guild.channels.cache.get(args[1]) : null);
        if (!channel) {
            return msg.channel.send(":negative_squared_cross_mark: Please mention a channel: `.alt-detector setchannel #channel`");
        }
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "logChannelId", channel.id);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Log Channel Set")
            .setDescription(`Alt detection alerts will be posted to <#${channel.id}>.`)
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "setrole") {
        const role = msg.mentions.roles.first() || (args[1] ? msg.guild.roles.cache.get(args[1]) : null);
        if (!role) {
            return msg.channel.send(":negative_squared_cross_mark: Please mention a role: `.alt-detector setrole @role`");
        }
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "quarantineRoleId", role.id);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Quarantine Role Set")
            .setDescription(`Detected alts with 'role' action will receive <@&${role.id}>.`)
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "setaction") {
        const level = args[1]?.toLowerCase();
        const action = args[2]?.toLowerCase();

        if (!level || !VALID_LEVELS.includes(level)) {
            return msg.channel.send(`:negative_squared_cross_mark: Invalid level. Valid levels: \`${VALID_LEVELS.join(", ")}\``);
        }
        if (!action || !VALID_ACTIONS.includes(action)) {
            return msg.channel.send(`:negative_squared_cross_mark: Invalid action. Valid actions: \`${VALID_ACTIONS.join(", ")}\``);
        }

        const field = LEVEL_TO_FIELD[level];
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, field, action);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Action Updated")
            .setDescription(`**${level}** → \`${action}\``)
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "status") {
        const config = await yuno.dbCommands.getAltDetectorConfig(yuno.database, guildId);

        const logChannel = config?.logChannelId ? `<#${config.logChannelId}>` : "*not set*";
        const quarantineRole = config?.quarantineRoleId ? `<@&${config.quarantineRoleId}>` : "*not set*";
        const enabled = config?.enabled ? ":green_circle: **Enabled**" : ":red_circle: **Disabled**";

        const actionNewbie = config?.actionNewbie || "none";
        const actionSuspicious = config?.actionSuspicious || "log";
        const actionHighlySuspicious = config?.actionHighlySuspicious || "log";
        const actionMegaSuspicious = config?.actionMegaSuspicious || "ban";

        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#5865F2")
            .setTitle(":mag: Alt Detector Status")
            .addFields(
                { name: "Status", value: enabled, inline: true },
                { name: "Log Channel", value: logChannel, inline: true },
                { name: "Quarantine Role", value: quarantineRole, inline: true },
                { name: "Actions by Severity", value:
                    `**newbie** → \`${actionNewbie}\`\n` +
                    `**suspicious** → \`${actionSuspicious}\`\n` +
                    `**highly-suspicious** → \`${actionHighlySuspicious}\`\n` +
                    `**mega-suspicious** → \`${actionMegaSuspicious}\``
                }
            )
            .setFooter({ text: "Valid actions: none | log | kick | ban | role" })
            .setCMDRequester(msg.member)
        ]});
    }

    return msg.channel.send(`:negative_squared_cross_mark: Unknown subcommand \`${sub}\`. Valid: enable, disable, setchannel, setrole, setaction, status`);
};

module.exports.about = {
    "command": "alt-detector",
    "description": "Configure the alt account detector. Actions: enable, disable, setchannel, setrole, setaction, status",
    "examples": [
        "alt-detector enable",
        "alt-detector disable",
        "alt-detector setchannel #mod-logs",
        "alt-detector setrole @Quarantine",
        "alt-detector setaction mega-suspicious ban",
        "alt-detector setaction suspicious log",
        "alt-detector status"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ManageGuild"],
    "aliases": ["altdetector", "altconfig"],
    "dangerous": false
};
