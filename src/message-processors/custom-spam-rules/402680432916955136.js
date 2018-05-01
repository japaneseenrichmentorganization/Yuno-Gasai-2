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


module.exports.id = "402680432916955136";

const {MessageEmbed} = require("discord.js");

let nsfwWarnings = {},
    fourMsgLongWarnings = new Set();

const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;

module.exports.message = function(content, msg) {
    if (msg.member.hasPermission("MANAGE_MESSAGES"))
        return;

    if (DISCORD_INVITE_REGEX.test(content))
        return msg.member.ban({
            days: 1,
            reason: "Autobanned: Sending a Discord invitation"
        })

    if (content.indexOf("@everyone") > -1 || content.indexOf("@here") > -1)
        return msg.member.ban({
            days: 1,
            member: "Autobanned: Usage of @everyone/@here"
        })

    // nsfw
    let parent = msg.channel.parent.name.toLowerCase();
    if (parent.indexOf("hentai palace") > -1 || parent.indexOf("nsfw-rl palace") > -1) {
        if (msg.content.toLowerCase().includes("http") || msg.attachments.first())
            return;

        // it's not good, warn!

        if (msg.deletable)
            msg.delete();
        
        if (typeof nsfwWarnings[msg.author.id] !== "number")
            nsfwWarnings[msg.author.id] = 1;
        else
            nsfwWarnings[msg.author.id] += 1;

        if (nsfwWarnings[msg.author.id] >= 3) {
            nsfwWarnings[msg.author.id] = 0;
            msg.member.ban({
                days: 1,
                member: "Autobanned: Chatting in NSFW channels."
            })
        } else {
            msg.author.send((new MessageEmbed()).setTitle("Be careful!")
                .setDescription("Please only post images in nsfw channels. This make browsing content more easy. You have now " + nsfwWarnings[msg.author.id] + " warning(s). At your third warning, you'll be banned.")
                .setColor("#f4bc42"));
        }
        return;
    }

    // 4 msg row
    // except in theses
    if (parent.indexOf("roleplayers") > -1 || msg.channel.name.indexOf("media") > -1 || parent.indexOf("bot") > -1 || msg.channel.name.indexOf("selfie-whores") > -1)
        return;

    let previousMessages = msg.channel.messages.last(4);
    
    if (previousMessages.length === 4 && previousMessages.every(m => m.author.id === msg.author.id)) {
        if (fourMsgLongWarnings.has(msg.author.id)) {
            msg.member.ban({
                days: 1,
                reason: "Autobanned: Four message long"
            })
            fourMsgLongWarnings.remove(msg.author.id);
        } else {
            msg.author.send((new MessageEmbed()).setTitle("Be careful!")
                .setDescription("Please keep your messages under 4 messages long. This is your last warning, next time: you'll be banned.")
                .setColor("#f4bc42"));
            fourMsgLongWarnings.add(msg.author.id);
        }
    }
}
