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


const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;
const LINK_REGEX = /[A-Z0-9-].(com|org|net|edu|xyz|gg|ly|co|gov|biz|tv|de|cc)/gi;

const spamWarnings = new Set();
const textInNoTextWarnings = new Set();

module.exports.id = "460934631487700993";

module.exports.message = async function(content, msg) {

        if (msg.member.hasPermission("MANAGE_MESSAGES"))
            return;

    if (DISCORD_INVITE_REGEX.test(content))
        return msg.member.ban({
            days: 1,
            reason: "Autobanned for invite link"
        })

    if (msg.channel.name.toLowerCase().startsWith("nsfw_")) {
        if (msg.content.toLowerCase().includes("http") || msg.attachments.first() || LINK_REGEX.test(content))
            return;

        if (textInNoTextWarnings.has(msg.author.id)) {
            msg.member.ban({
                days: 1,
                reason: "Autobanned messages hentai channel"
            })
            textInNoTextWarnings.delete(msg.author.id);
        } else {
            msg.author.send("8. Text other than links is not allowed in hentai channels. If you wish to comment on something in a hentai channel, #media or #meme-machine do so in main chat and reference the channel youre commenting on.This is to prevent unnecessary clutter so people can easily see the content posted in the channels.")
            textInNoTextWarnings.add(msg.author.id);
            if (msg.deletable)
                msg.delete();
        }
        return;
    }

    if (msg.content.indexOf("@everyone") > -1 || msg.content.indexOf("@here") > -1)
        return msg.member.ban({
            days: 1,
            reason: "Autobanned by spam filter: usage of @everyone/@here"
        })

        if (LINK_REGEX.test(content) && msg.channel.name.toLowerCase().startsWith("main")) {
            if (spamWarnings.has(msg.author.id)) {
                msg.member.ban({
                    days: 1,
                    reason: "Autobanned for sending links"
                })
                spamWarnings.delete(msg.author.id);
            } else {
                msg.reply("Please do not send links. This is your one and only warning.\nFailure to comply will result in a ban.");
                spamWarnings.add(msg.author.id);
                if (msg.deletable)
                    msg.delete();
            };
        };

    let previousMessages = msg.channel.messages.last(4);
    
    if (previousMessages.length === 4 && msg.channel.name.toLowerCase().startsWith("main") && previousMessages.every(m=> m.author.id === msg.author.id))
        if (spamWarnings.has(msg.author.id)) {
            msg.member.ban({
                days: 1,
                reason: "Autobanned message limit"
            })
            spamWarnings.delete(msg.author.id)
        } else {
            msg.reply("Please keep your messages under 4 messages long. This is your one and only warning.\nFailure to comply will result in a ban.");
            spamWarnings.add(msg.author.id);
        }
}
