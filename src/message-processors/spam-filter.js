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

const {MessageEmbed} = require("discord.js"),
    fs = require("fs"),
    prompt = (require("../lib/prompt")).init();

const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;
const LINK_REGEX = /(ftp|http|https):\/\/(www\.)??[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/ig;

let maxWarnings = 3,
    spamfilt = {},
    warnings = {},
    customspamrules = {};

// reading custom spam rules files
try {
    fs.readdirSync("./src/message-processors/custom-spam-rules", "utf8").forEach(el => {
        el = "./custom-spam-rules/" + el;
        let test = require.resolve(el);
        delete require.cache[require.resolve(el)];
        let req = require(el);
        customspamrules[req.id] = req;
    })
} catch(e) {
    prompt.error("Error while reading custom-spam-rules", e);
}

let ban = function(msg, banreason, warningmsg) {
    if (msg.deletable)
        msg.delete();
    if (typeof warnings[msg.author.id] !== "number")
        warnings[msg.author.id] = 1;
    else
        warnings[msg.author.id] += 1;

    if (warnings[msg.author.id] >= maxWarnings) {
        msg.author.send((new MessageEmbed()).setTitle("And here you go. You got banned!")
            .setDescription("Reason: " + warningmsg)
            .setColor("#ff0000"));
        return msg.member.ban({
            "days": 1,
            "reason": banreason + " Used all his warnings."
        });
    }

    warningmsg += "\nYou have " + warnings[msg.author.id] + " warning(s). Don't forget that you'll be banned from the server when you'll reach " + maxWarnings + " warning(s)."
    msg.author.send((new MessageEmbed()).setTitle("Be careful! You're getting banned!")
        .setDescription(warningmsg));
}



module.exports.message = async function(content, msg) {
    if (new String(spamfilt[msg.guild.id]).toLowerCase() === "false")
        return;

    if (Object.keys(customspamrules).includes(msg.guild.id))
        return customspamrules[msg.guild.id].message(content, msg);

     //If the user is a bot, ignore them
    if (!msg.member)
        return;

    //If the user has the ability to manage messages, ignore them
    if (msg.member.hasPermission("MANAGE_MESSAGES"))
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
    let messages = msg.channel.messages.last(4);
    if (!msg.channel.nsfw && messages.length === 4 && messages.every(m => m.author.id === msg.author.id))
        ban(msg, "Autobanned by spam filter: 4 messages at a row.", "Please keep your messages under 4 messages long.");
    
}

module.exports.discordConnected = async function(Yuno) {
    spamfilt = await Yuno.dbCommands.getSpamFilterEnabled(Yuno.database);

    Object.values(customspamrules).forEach(el => typeof el.discordConnected === "function" ? el.discordConnected(Yuno) : null);
}

module.exports.configLoaded = async function(Yuno, config) {
    Object.values(customspamrules).forEach(el => typeof el.configLoaded === "function" ? el.configLoaded(Yuno, config) : null);

    let spamWarnings = config.get("spam.max-warnings");

    if (typeof spamWarnings === "number")
        maxWarnings = spamWarnings;
    else
        Yuno.prompt.warning("The value spam.max-warnings was expected to be a number, but it's a " + typeof maxWarnings + ". Using default max-warnings value: " + maxWarnings);
}