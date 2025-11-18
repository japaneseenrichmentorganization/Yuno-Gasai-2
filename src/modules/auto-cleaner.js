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

const {Guild, Channel, EmbedBuilder} = require("discord.js");

let intervalManager = null;

module.exports.modulename = "auto-cleaner";

let setupCleaners = async function(Yuno) {
    let dcom = Yuno.dbCommands,
        cleans = await dcom.getCleans(Yuno.database);

    cleans.forEach(el => {
        let g = Yuno.dC.guilds.cache.get(el.guildId);

        if (!(g instanceof Guild))
            return this.prompt.error("Cannot (auto-)clean a channel: guild doesn't exists! GuildId: " + el.guildId);

        if (!intervalManager._has("autocleaner-clean-" + el.guildId + "-" + el.channelName))
            intervalManager.setInterval("autocleaner-clean-" + el.guildId + "-" + el.channelName, (async function(clean) {
                let actualClean = await Yuno.dbCommands.getClean(Yuno.database, el.guildId, el.channelName);

                if (actualClean === null)
                    return;

                let ch = g.channels.cache.find((ch) => ch.name.toLowerCase() === el.channelName);

                if (!(ch instanceof Channel)) {
                    Yuno.dbCommands.delClean(Yuno.database, el.guildId, el.channelName)
                    return Yuno.prompt.error("Cannot (auto-)clean a channel: channel doesn't exists! Guild name: " + g.name + "; ChannelName: " + el.channelName);
                }

                if (actualClean.remainingTime === actualClean.timeBeforeClean)
                    ch.send({embeds: [new EmbedBuilder()
                        .setAuthor({name: "Yuno is going to clean this channel in " + actualClean.timeBeforeClean + " minutes. Speak now or forever hold your peace."})]})

                if (actualClean.remainingTime <= 0) {
                    (await Yuno.UTIL.clean(ch)).send({embeds: [new EmbedBuilder()
                        .setImage("https://vignette3.wikia.nocookie.net/futurediary/images/9/94/Mirai_Nikki_-_06_-_Large_05.jpg")
                        .setAuthor({name: "Auto-clean: Yuno is done cleaning.", iconURL: Yuno.dC.user.avatarURL()})
                        .setColor("#ff51ff")]});
                    actualClean.remainingTime = actualClean.timeFEachClean * 60;
                } else {
                    actualClean.remainingTime = actualClean.remainingTime - 1;
                }

                await Yuno.dbCommands.setClean(Yuno.database, actualClean.guildId, el.channelName, actualClean.timeFEachClean, actualClean.timeBeforeClean, actualClean.remainingTime)
            }).bind(Yuno, el), 60 * 1000);
    });
}

module.exports.configLoaded = function() {

}

module.exports.init = function(Yuno, hotreloaded) {
    intervalManager = Yuno.intervalMan;

    if (hotreloaded)
        setupCleaners(Yuno)
    else
        Yuno.on("discord-connected", setupCleaners.bind(Yuno, Yuno));
}
