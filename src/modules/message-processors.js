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

let workOnlyOnGuild = null,
    messageProcsors = [],
    messageProcsorsPaths = [],
    DISCORD_EVENT = false,
    commandExecutor = null;

module.exports.modulename = "message-processors";

let readModule = function(file) {
    return new Promise(function(res, rej) {
        try {
            let path = require.resolve("../message-processors/" + file);
            delete require.cache[path]
            messageProcsorsPaths.push(path);
            messageProcsors.push(require(path));
        } catch(e) {
            // adding more information to the error
            e.message = "Error thrown in message-processors.js : " + e.message;
            e.from = typeof path !== "undefined" ? path : null;
            rej(e);
        }
        res();
    })
}

let readModules = async function() {
    messageProcsors = [];
    messageProcsorsPaths = [];
    let messageProcessorsPath = fs.readdirSync("src/message-processors", "utf8");

    messageProcessorsPath.forEach((async function(el) {
        if (el.indexOf(".js") === el.length - ".js".length)
            await readModule(el);
    }));
}

let discordConnected = async function(Yuno) {
    await readModules();
    let discClient = Yuno.dC;

    messageProcsors.forEach(async e => {
        await e.configLoaded(Yuno, Yuno.config);
        await e.discordConnected(Yuno);
    })

    let workOnlyOnGuild_ = discClient.guilds.cache.get(workOnlyOnGuild);
    
    if (workOnlyOnGuild_ !== null)
        workOnlyOnGuild = workOnlyOnGuild_

    if (!DISCORD_EVENT) {
        DISCORD_EVENT = true;

        discClient.on("message", (function(msg) {
            if (msg.author.id === discClient.user.id)
                return;
    
            if (!msg.guild)
                return;
    
            if (typeof workOnlyOnGuild !== "undefined" && workOnlyOnGuild !== null && workOnlyOnGuild.id !== msg.guild.id)
                return;
    
            let content = msg.content;
    
            for(proces of messageProcsors) {
                try {
                    proces.message(content, msg);
                } catch(e) {
                    e.message = "Error thrown while triggered \"message\" event for the message-processor \"" + proces.messageProcName + "\""
                    throw e;
                }
            }
        }))
    }
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded)
        discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected)
}

module.exports.configLoaded = function(Yuno, config) {
    let workOnlyOnGuild_ = config.get("debug.work-only-on-guild");

    if (typeof workOnlyOnGuild_ === "string")
        workOnlyOnGuild = workOnlyOnGuild_
}
