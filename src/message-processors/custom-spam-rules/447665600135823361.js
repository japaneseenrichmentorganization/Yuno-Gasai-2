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

const {PermissionsBitField} = require("discord.js");

const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;
const LINK_REGEX = /(ftp|http|https):\/\/(www\.)??[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/ig;

const spamWarnings = new Set();
const textInNoTextWarnings = new Set();

module.exports.id = "447665600135823361";

module.exports.message = async function(content, msg) {

        // Obtain the member if we don't have it
        if(msg.guild && !msg.guild.members.cache.has(msg.author.id) && !msg.webhookID) {
            msg.member = await msg.guild.members.fetch(msg.author.id);
        }
        // Obtain the member for the ClientUser if it doesn't already exist
        if(msg.guild && !msg.guild.members.cache.has(Yuno.dC.user.id)) {
            await msg.guild.members.fetch(Yuno.dC.user.id);
        }

        if (msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
            return;

    if (DISCORD_INVITE_REGEX.test(content))
        return msg.member.ban({
            deleteMessageSeconds: 86400,
            reason: "Autobanned for invite link"
        })

    if (msg.channel.name.toLowerCase().startsWith("nsfw_")) {
        if (msg.content.toLowerCase().includes("http") || msg.attachments.first() || LINK_REGEX.test(content))
            return;

        if (textInNoTextWarnings.has(msg.author.id)) {
            msg.member.ban({
                deleteMessageSeconds: 86400,
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
            deleteMessageSeconds: 86400,
            reason: "Autobanned by spam filter: usage of @everyone/@here"
        })

        if (LINK_REGEX.test(content) && msg.channel.name.toLowerCase().startsWith("main")) {
            if (spamWarnings.has(msg.author.id)) {
                msg.member.ban({
                    deleteMessageSeconds: 86400,
                    reason: "Autobanned for sending links"
                })
                spamWarnings.delete(msg.author.id);
            } else {
                msg.reply("Please do not send links. This is your one and only warning.\nFailure to comply will result in a ban.");
                spamWarnings.add(msg.author.id);
                if (msg.deletabe);
                    msg.delete();
            };
        };

    let previousMessages = Array.from(msg.channel.messages.cache.values()).slice(-4);

    if (previousMessages.length === 4 && msg.channel.name.toLowerCase().startsWith("main") && previousMessages.every(m=> m.author.id === msg.author.id))
        if (spamWarnings.has(msg.author.id)) {
            msg.member.ban({
                deleteMessageSeconds: 86400,
                reason: "Autobanned message limit"
            })
            spamWarnings.delete(msg.author.id)
        } else {
            msg.reply("Please keep your messages under 4 messages long. This is your one and only warning.\nFailure to comply will result in a ban.");
            spamWarnings.add(msg.author.id);
        }
}
