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

// hot-reload
delete require.cache[require.resolve("../Util")]

const {MessageEmbed} = require("discord.js"),
    Util = require("util"),
    DiscordUtil = require("../Util");


/**
 * Embed Command Response (a nice way to return response from command)
 * @param {Object} data Data to set in the rich embed
 * @extends {MessageEmbed}
 */
let EmbedCmdResponse = function(data) {
    Object.getPrototypeOf(MessageEmbed.prototype).constructor.call(this, data);
}

EmbedCmdResponse.setCMDRequester = function(embed, user) {
    let username = user.nickname ? user.nickname : user.user.tag;
    
    embed.setFooter("Requested by " + username, DiscordUtil.getAvatarURL(user.user))
    return embed;
}

Util.inherits(EmbedCmdResponse, MessageEmbed);

/**
 * Sets the command requester at the footer.
 * @param {GuildMember} user
 * @return {EmbedCmdResponse} itself.
 * @deprecated
 */
EmbedCmdResponse.prototype.setCMDRequester = function(user) {
    let username = user.nickname ? user.nickname : user.user.tag;
    
    this.setFooter("Requested by " + username, DiscordUtil.getAvatarURL(user.user))
    return this;
}

/**
 * Sets the description of the footer, but joins the arguments
 * @param {String} description...
 * @return {EmbedCmdResponse} itself.
 * @deprecated
 */
EmbedCmdResponse.prototype.setDescription = function() {
    let things = Array.from(arguments),
        description = "";

    things.forEach(el => description += el + " ");

    description.substring(0, -1);

    MessageEmbed.prototype.setDescription.call(this, description);
    return this;
}

module.exports = EmbedCmdResponse;