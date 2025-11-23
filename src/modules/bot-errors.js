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

let discordConnected = async function(Yuno) {
    let dC = Yuno.dC,
        guilds = dC.guilds;

    guild = guilds.cache.get(guildId);

    if (!guild)
        return Yuno.prompt.error("Cannot log bot errors into a channel: GuildID: " + guildId + " is invalid. Try putting a guild ID instead")

    // Fetch all channels to ensure cache is populated
    try {
        await guild.channels.fetch();
    } catch (e) {
        Yuno.prompt.error("Failed to fetch guild channels: " + e.message);
    }

    // Try to find channel by ID first (if channelName looks like an ID)
    if (/^\d+$/.test(channelName)) {
        channel = guild.channels.cache.get(channelName);
        if (!channel) {
            // Try fetching directly
            try {
                channel = await guild.channels.fetch(channelName);
            } catch (e) {
                Yuno.prompt.warn("Could not fetch channel by ID: " + e.message);
            }
        }
    }
    
    // If not found by ID, try by name
    if (!channel) {
        channel = guild.channels.cache.find(ch => ch.name === channelName);
    }

    if (!channel) {
        Yuno.prompt.error("Cannot log bot errors into a channel: ChannelName/ID: " + channelName + " is invalid.");
        Yuno.prompt.info("Available channels in guild: " + Array.from(guild.channels.cache.values()).map(ch => ch.name + " (" + ch.id + ")").join(", "));
        return;
    }

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
