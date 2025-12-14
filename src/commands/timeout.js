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

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length < 2) {
        return msg.channel.send(":negative_squared_cross_mark: Usage: `.timeout @user <duration in minutes> [reason]`");
    }

    const target = msg.mentions.users.first();
    if (!target) {
        return msg.channel.send(":negative_squared_cross_mark: Please mention a user to timeout.");
    }

    const duration = parseInt(args[1], 10);
    if (isNaN(duration) || duration < 1) {
        return msg.channel.send(":negative_squared_cross_mark: Please provide a valid duration in minutes (minimum 1).");
    }

    // Maximum timeout is 28 days (40320 minutes)
    if (duration > 40320) {
        return msg.channel.send(":negative_squared_cross_mark: Maximum timeout duration is 28 days (40320 minutes).");
    }

    const reason = args.slice(2).join(" ") || "No reason provided";

    try {
        const member = await msg.guild.members.fetch(target.id);

        if (!member) {
            return msg.channel.send(":negative_squared_cross_mark: User is not in this server.");
        }

        // Check if target is higher in hierarchy
        if (member.roles.highest.position >= msg.member.roles.highest.position && msg.guild.ownerId !== msg.author.id) {
            return msg.channel.send(":negative_squared_cross_mark: You cannot timeout this user as they have equal or higher roles.");
        }

        // Check if bot can timeout this user
        const botMember = await msg.guild.members.fetch(msg.client.user.id);
        if (member.roles.highest.position >= botMember.roles.highest.position) {
            return msg.channel.send(":negative_squared_cross_mark: I cannot timeout this user as they have equal or higher roles than me.");
        }

        // Apply the timeout
        const timeoutMs = duration * 60 * 1000;
        await member.timeout(timeoutMs, `${reason} (by ${msg.author.tag})`);

        // Record to database
        await yuno.dbCommands.addModAction(
            yuno.database,
            msg.guild.id,
            msg.author.id,
            target.id,
            "timeout",
            reason,
            Date.now()
        );

        const embed = new EmbedBuilder()
            .setColor("#ff9900")
            .setTitle("User Timed Out")
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "User", value: `${target.tag} (${target.id})`, inline: true },
                { name: "Duration", value: `${duration} minute(s)`, inline: true },
                { name: "Moderator", value: msg.author.tag, inline: true },
                { name: "Reason", value: reason }
            )
            .setTimestamp();

        return msg.channel.send({ embeds: [embed] });

    } catch (e) {
        console.error("Timeout error:", e);
        return msg.channel.send(`:x: Error timing out user: ${e.message}`);
    }
}

module.exports.about = {
    "command": "timeout",
    "description": "Timeout a user for a specified duration.",
    "usage": "timeout @user <duration in minutes> [reason]",
    "examples": ["timeout @user 10 Spamming", "timeout @user 60"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ModerateMembers"],
    "aliases": ["mute", "to"]
}
