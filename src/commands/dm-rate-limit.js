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

const VALID_ACTIONS = ["ignore", "ban"];

module.exports.run = async function(yuno, author, args, msg) {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === "status") {
        const enabled = yuno.config.get("dm-rate-limit.enabled") !== false;
        const spamAction = yuno.config.get("dm-rate-limit.spamAction") || "ignore";

        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#5865F2")
            .setTitle(":mailbox_with_mail: DM Rate Limit Status")
            .addFields(
                { name: "Status", value: enabled ? ":green_circle: **Enabled**" : ":red_circle: **Disabled**", inline: true },
                { name: "Spam Action", value: `\`${spamAction}\``, inline: true },
                { name: "How it works", value:
                    "Each user gets a randomized message limit (6–10 msg/60s).\n" +
                    "The limit **tightens** for every dropped message.\n" +
                    "After **5 dropped messages** with no human reply → spam action fires.\n" +
                    "Human replies (via `reply` command) grant **leniency** for 10 minutes."
                }
            )
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "enable") {
        yuno.config.set("dm-rate-limit.enabled", true).save();
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: DM Rate Limiting Enabled")
            .setDescription("Adaptive DM rate limiting is now **enabled**.")
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "disable") {
        yuno.config.set("dm-rate-limit.enabled", false).save();
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#ff6600")
            .setTitle(":octagonal_sign: DM Rate Limiting Disabled")
            .setDescription("DM rate limiting is now **disabled**.")
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "set-action") {
        const action = args[1]?.toLowerCase();
        if (!action || !VALID_ACTIONS.includes(action)) {
            return msg.channel.send(`:negative_squared_cross_mark: Invalid action. Valid: \`${VALID_ACTIONS.join(", ")}\``);
        }
        yuno.config.set("dm-rate-limit.spamAction", action).save();
        const desc = action === "ban"
            ? "Spam users will be **permanently bot-banned** automatically."
            : "Spam users will be **temp-blocked for 1 hour** (resets on restart).";
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Spam Action Updated")
            .setDescription(`Spam action set to \`${action}\`. ${desc}`)
            .setCMDRequester(msg.member)
        ]});
    }

    return msg.channel.send(
        `:negative_squared_cross_mark: Unknown subcommand \`${sub}\`. Valid: \`enable\`, \`disable\`, \`set-action\`, \`status\``
    );
};

module.exports.about = {
    "command": "dm-rate-limit",
    "description": "Configure DM rate limiting and spam detection. Subcommands: enable, disable, set-action, status",
    "examples": [
        "dm-rate-limit status",
        "dm-rate-limit enable",
        "dm-rate-limit disable",
        "dm-rate-limit set-action ignore",
        "dm-rate-limit set-action ban"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ManageGuild"],
    "aliases": ["dmratelimit", "dmrl"],
    "dangerous": false
};
