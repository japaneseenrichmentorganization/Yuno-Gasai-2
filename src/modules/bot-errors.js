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

// Helper: Format mentions string
const getMentions = () =>
    mentionOnCrash
        ?.filter(el => typeof el === "string")
        .map(el => `<@!${el}>`)
        .join(" ") ?? "";

// Helper: Validate error config object
const isValidErrorConfig = (c) =>
    c &&
    typeof c === "object" &&
    typeof c.guild === "string" &&
    typeof c.channel === "string";

// Helper: Resolve channel by ID or name
const resolveChannel = async (guild, identifier, Yuno) => {
    const isId = /^\d+$/.test(identifier);

    if (isId) {
        const cached = guild.channels.cache.get(identifier);
        if (cached) return cached;

        try {
            return await guild.channels.fetch(identifier);
        } catch (e) {
            Yuno.prompt.warn(`Could not fetch channel by ID: ${e.message}`);
        }
    }

    return guild.channels.cache.find(ch => ch.name === identifier) ?? null;
};

const discordConnected = async function(Yuno) {
    guild = Yuno.dC.guilds.cache.get(guildId);

    if (!guild) {
        return Yuno.prompt.error(`Cannot log bot errors: GuildID ${guildId} is invalid.`);
    }

    // Fetch all channels to ensure cache is populated
    try {
        await guild.channels.fetch();
    } catch (e) {
        Yuno.prompt.error(`Failed to fetch guild channels: ${e.message}`);
    }

    // Use helper function to resolve channel
    channel = await resolveChannel(guild, channelName, Yuno);

    if (!channel) {
        const availableChannels = Array.from(guild.channels.cache.values())
            .map(ch => `${ch.name} (${ch.id})`)
            .join(", ");
        Yuno.prompt.error(`Cannot log bot errors: Channel ${channelName} is invalid.`);
        Yuno.prompt.info(`Available channels: ${availableChannels}`);
        return;
    }

    Yuno.prompt.info(`Errors logged on ${guild.name} in #${channel.name}`);
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded) {
        await discordConnected(Yuno);
    } else {
        Yuno.on("discord-connected", discordConnected);
    }

    if (!ONE_TIME_EVENT) {
        // Use arrow function instead of .bind()
        Yuno.on("error", async (e) => {
            if (guild && channel) {
                const possibleMoreInfo = ["From"];
                const moreInfo = possibleMoreInfo
                    .filter(key => e.hasOwnProperty(key.toLowerCase()))
                    .map(key => e[key.toLowerCase()])
                    .join("\n");

                const errorString = moreInfo
                    ? `${e.message}\nMore information: ${moreInfo}`
                    : e.message;

                await channel.send(`${getMentions()}An exception happened :'(.\`\`\`${errorString}\`\`\``);
            }
        });
    }

    ONE_TIME_EVENT = true;
}

module.exports.configLoaded = function(Yuno, config) {
    const c = config.get("errors.dropon");

    // Use helper for validation
    if (isValidErrorConfig(c)) {
        channelName = c.channel;
        guildId = c.guild;
    } else if (c !== null) {
        config.set("errors.dropon", null);
    }

    // Use ternary with nullish assignment
    const mentionOnCrash_ = config.get("errors.mentionwhencrash");
    mentionOnCrash = Array.isArray(mentionOnCrash_) ? mentionOnCrash_ : [];

    if (!Array.isArray(mentionOnCrash_)) {
        config.set("errors.mentionwhencrash", mentionOnCrash);
    }
}
