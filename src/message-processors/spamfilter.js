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

module.exports.messageProcName = "spam-filter"

const {EmbedBuilder, PermissionsBitField} = require("discord.js"),
    fs = require("fs"),
    fsPromises = require("fs").promises,
    prompt = (require("../lib/prompt")).init();

const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;
const LINK_REGEX = /(ftp|http|https):\/\/(www\.)??[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/ig;

let maxWarnings = 3,
    spamfilt = {},
    warnings = {},
    customspamrules = {},
    customSpamRulesLoaded = false;

// Load custom spam rules asynchronously
async function loadCustomSpamRules() {
    if (customSpamRulesLoaded) return;
    try {
        const files = await fsPromises.readdir("./src/message-processors/custom-spam-rules", "utf8");
        for (const el of files) {
            let filePath = "./custom-spam-rules/" + el;
            let resolvedPath = require.resolve(filePath);
            delete require.cache[resolvedPath];
            let req = require(filePath);
            customspamrules[req.id] = req;
        }
        customSpamRulesLoaded = true;
    } catch(e) {
        if (e.code !== "ENOENT") {
            prompt.error("Error while reading custom-spam-rules", e);
        }
    }
}

let ban = function(msg, banreason, warningmsg) {
    if (msg.deletable)
        msg.delete();
    if (typeof warnings[msg.author.id] !== "number")
        warnings[msg.author.id] = 1;
    else
        warnings[msg.author.id] += 1;

    if (warnings[msg.author.id] >= maxWarnings) {
        msg.author.send({embeds: [(new EmbedBuilder()).setTitle("And here you go. You got banned!")
            .setDescription("Reason: " + warningmsg)
            .setColor("#ff0000")]});
        return msg.member.ban({
            "deleteMessageSeconds": 86400,
            "reason": banreason + " Used all his warnings."
        });
    }

    warningmsg += "\nYou have " + warnings[msg.author.id] + " warning(s). Don't forget that you'll be banned from the server when you'll reach " + maxWarnings + " warning(s)."
    msg.author.send({embeds: [(new EmbedBuilder()).setTitle("Be careful! You're getting banned!")
        .setDescription(warningmsg)]});
}



module.exports.message = async function(content, msg) {
    // Check if spam filter is disabled for this guild
    const filterSetting = spamfilt[msg.guild.id];
    if (filterSetting === false || filterSetting === "false") return;

    // Delegate to custom rules if they exist for this guild
    if (Object.prototype.hasOwnProperty.call(customspamrules, msg.guild.id)) {
        return customspamrules[msg.guild.id].message(content, msg);
    }
// Obtain the member if we don't have it
    if(msg.guild && !msg.guild.members.cache.has(msg.author.id) && !msg.webhookID) {
        msg.member = await msg.guild.members.fetch(msg.author);
    }
    // Obtain the member for the ClientUser if it doesn't already exist
    if(msg.guild && !msg.guild.members.cache.has(msg.client.user.id)) {
        await msg.guild.members.fetch(msg.client.user.id);
    }


    //If the user has the ability to manage messages, ignore them
    if (msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
        return;

    //If the user pings @everyone or @here, ban them
    if (content.indexOf("@everyone") > -1 || content.indexOf("@here") > -1)
        return ban(msg, "Autobanned by spam filter: usage of @everyone/@here.", "Don't mention @everyone or @here.");

    let test = DISCORD_INVITE_REGEX.exec(content);

    //If the user sends a discord invite link, warn them and then ban them after 3 warnings
    if (test !== null && test.length > 0)
        return ban(msg, "Autobanned by spam filter: Discord invitation link sent.", "Don't send any Discord invitation links here.");

    let linkReg = LINK_REGEX.exec(content);

    //If a user sends a link, warn them and then ban them after 3 warnings
    if (linkReg !== null && linkReg.length > 0)
        return ban(msg, "Autobanned by spam filter: Link sent.", "Don't send any links here.");
    
    //If a user sends more than 4 messages before another user, warn them and ban them after 3 warnings
    let messages = Array.from(msg.channel.messages.cache.values()).slice(-4);
    if (!msg.channel.nsfw && messages.length === 4 && messages.every(m => m.author.id === msg.author.id))
        ban(msg, "Autobanned by spam filter: 4 messages at a row.", "Please keep your messages under 4 messages long.");
    
}

module.exports.discordConnected = async function(Yuno) {
    await loadCustomSpamRules();
    spamfilt = await Yuno.dbCommands.getSpamFilterEnabled(Yuno.database);

    for (const el of Object.values(customspamrules)) {
        if (typeof el.discordConnected === "function")
            await el.discordConnected(Yuno);
    }
}

module.exports.configLoaded = async function(Yuno, config) {
    for (const el of Object.values(customspamrules)) {
        if (typeof el.configLoaded === "function")
            await el.configLoaded(Yuno, config);
    }

    let spamWarnings = config.get("spam.max-warnings");

    if (typeof spamWarnings === "number")
        maxWarnings = spamWarnings;
    else
        Yuno.prompt.warning("The value spam.max-warnings was expected to be a number, but it's a " + typeof maxWarnings + ". Using default max-warnings value: " + maxWarnings);
}
