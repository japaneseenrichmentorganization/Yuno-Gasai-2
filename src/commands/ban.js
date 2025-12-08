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

const FAIL_COLOR = "#ff0000";
const SUCCESS_COLOR = "#43cc24";

// hot-reload things
delete require.cache[require.resolve("../lib/EmbedCmdResponse")];

let EmbedCmdResponse = require("../lib/EmbedCmdResponse");

const {GuildMember} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    args = args.join(" ");

    let reason = "",
        toBanIds = [];

    if (args.includes("|")) {
        reason = (args.split("|")[1] + " / Banned by " + msg.author.tag).trim();
        args = args.split("|")[0];
    } else {
        reason = "Banned by " + msg.author.tag;
    }

    let toBanThings = args.split(" "),
        usersToBan = [];

    // Collect mentioned users
    let userMentions = Array.from(msg.mentions.users.values());
    for (let user of userMentions) {
        usersToBan.push({
            user: user,
            inGuild: msg.guild.members.cache.has(user.id)
        });
    }

    // Process IDs (non-mentions)
    for (let i = 0; i < toBanThings.length; i++) {
        let e = toBanThings[i].trim();
        
        // Skip if empty or is a mention
        if (!e || e.indexOf("<") > -1) continue;

        // Try to fetch as user ID
        try {
            // First try to fetch from guild (member)
            let member = await msg.guild.members.fetch(e).catch(() => null);
            
            if (member) {
                // User is in the guild
                usersToBan.push({
                    user: member.user,
                    inGuild: true
                });
            } else {
                // Try to fetch user from Discord API (not in guild)
                let user = await msg.client.users.fetch(e).catch(() => null);
                
                if (user) {
                    usersToBan.push({
                        user: user,
                        inGuild: false
                    });
                } else {
                    // User not found at all
                    msg.channel.send({embeds: [new EmbedCmdResponse()
                        .setColor(FAIL_COLOR)
                        .setTitle(":negative_squared_cross_mark: Ban failed.")
                        .setDescription(`:arrow_right: Failed to ban user with ID \`${e}\`: User not found on Discord.`)
                        .setCMDRequester(msg.member)]});
                }
            }
        } catch (err) {
            msg.channel.send({embeds: [new EmbedCmdResponse()
                .setColor(FAIL_COLOR)
                .setTitle(":negative_squared_cross_mark: Ban failed.")
                .setDescription(`:arrow_right: Failed to process \`${e}\`: ${err.message}`)
                .setCMDRequester(msg.member)]});
        }
    }

    if (usersToBan.length === 0) {
        return msg.channel.send(":negative_squared_cross_mark: No users to ban. Please mention users or provide user IDs.");
    }

    // Ban each user
    for (let targetData of usersToBan) {
        let target = targetData.user;
        let inGuild = targetData.inGuild;

        // Check if target is a master user
        if (yuno.commandMan._isUserMaster(target.id)) {
            msg.channel.send({embeds: [new EmbedCmdResponse()
                .setColor(FAIL_COLOR)
                .setTitle(":negative_squared_cross_mark: Ban failed.")
                .setDescription(`:arrow_right: Failed to ban user ${target.tag}. The user is on the master list.`)
                .setCMDRequester(msg.member)]});
            continue;
        }

        // Prepare success embed
        let successfulEmbed = new EmbedCmdResponse()
            .setColor(SUCCESS_COLOR)
            .setTitle(":white_check_mark: Ban successful.")
            .setDescription(`:arrow_right: User ${target.tag} has been successfully banned.${inGuild ? '' : ' (User was not in server)'}`)
            .setCMDRequester(msg.member);

        let banImage = await yuno.dbCommands.getBanImage(yuno.database, msg.guild.id, msg.author.id);

        if (banImage === null) {
            banImage = yuno.config.get("ban.default-image");
        }

        if (banImage !== null && yuno.UTIL.checkIfUrl(banImage)) {
            successfulEmbed.setImage(banImage);
        }

        // Execute the ban
        try {
            await msg.guild.members.ban(target.id, {
                deleteMessageSeconds: 86400,
                reason: reason
            });

            // Record to database for mod-stats
            await yuno.dbCommands.addModAction(
                yuno.database,
                msg.guild.id,
                msg.author.id,
                target.id,
                "ban",
                reason,
                Date.now()
            );

            msg.channel.send({embeds: [successfulEmbed]});
        } catch (err) {
            msg.channel.send({embeds: [new EmbedCmdResponse()
                .setColor(FAIL_COLOR)
                .setTitle(":negative_squared_cross_mark: Ban failed.")
                .setDescription(`:arrow_right: Failed to ban ${target.tag}: ${err.message}`)
                .setCMDRequester(msg.member)]});
        }
    }
}

module.exports.about = {
    "command": "ban",
    "description": "Bans users from the server. Works with mentions, user IDs (in server), and user IDs (not in server).",
    "examples": [
        "ban @someone | reason",
        "ban 123456789012345678 | spam",
        "ban @user1 @user2 123456789012345678 | multiple users",
        "ban 123456789012345678"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["BAN_MEMBERS"],
    "aliases": ["bean", "banne"],
    "dangerous": true
}
