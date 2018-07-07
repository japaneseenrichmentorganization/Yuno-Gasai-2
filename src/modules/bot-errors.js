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

let channelName = null,
    guildId = null,
    guild = null,
    channel = null,

    mentionOnCrash = null,

    ONE_TIME_EVENT = false;

module.exports.modulename = "bot-errors";

let getMentions = function() {
    let str = "";
    mentionOnCrash.forEach(el => str += (typeof el === "string" ? "<@!" + el + "> " : ""))
    return str;
}

let discordConnected = function(Yuno) {
    let dC = Yuno.dC,
        guilds = dC.guilds;

    guild = guilds.get(guildId);

    if (typeof guild === "undefined")
        return Yuno.prompt.error("Cannot log bot errors into a channel: GuildID: " + guildId + " is invalid. Try putting a guild ID instead")

    channel = guild.channels.find("name", channelName);

    if (typeof channel === "undefined")
        return Yuno.prompt.error("Cannot log bot errors into a channel: ChannelName: " + channelName + " is invalid. Try putting a channel name instead")

    if (guild && channel)
        Yuno.prompt.info("Errors logged on the guild " + guild.name + " on the channel " + channel.name)
}

module.exports.init = function(Yuno, hotReloaded) {
    if (hotReloaded) {
        discordConnected(Yuno);
    } else
        Yuno.on("discord-connected", discordConnected);

    if (!ONE_TIME_EVENT)
        Yuno.on("error", (function(e) {
            if (guild && channel) {
                let errorString = e.message,
                    moreInformations = "",
                    possibleMoreInformations = ["From"];

                possibleMoreInformations.forEach(el => {
                    if (e.hasOwnProperty(el.toLowerCase())) {
                        moreInformations += "\n" + e[el.toLowerCase()]
                    }
                })

                if (moreInformations !== "")
                    errorString += "\nMore informations: " + moreInformations;

                channel.send(getMentions() + "An exception happened :'(." + "```" + errorString + "```")
            }
        }).bind(Yuno));

    ONE_TIME_EVENT = true;
}

module.exports.configLoaded = function(Yuno, config) {
    let c = config.get("errors.dropon");

    if (typeof c === "object" && c.hasOwnProperty("guild") && c.hasOwnProperty("channel") && typeof c.guild === "string" && typeof c.channel === "string") {
        channelName = c.channel;
        guildId = c.guild;
    } else if (c !== null) {
        config.set("errors.dropon", null);
    }

    let mentionOnCrash_ = config.get("errors.mentionwhencrash");

    if (mentionOnCrash_ instanceof Array)
        mentionOnCrash = mentionOnCrash_;
    else
        config.set("errors.mentionwhencrash", mentionOnCrash = []);
}
