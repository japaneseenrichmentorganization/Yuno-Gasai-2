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
	defaultPrefix = null,
	prefixes = null,
	dmMessage = null,

	discClient,
	Yuno,

	ONE_TIME_EVENT = false;

module.exports.modulename = 'command-executor';

let msgEvent = (function(msg) {
	if (msg.author.id === discClient.user.id)
		return;

	// if message sent in DM
	if (!msg.guild) {
		let command = msg.content.substring(defaultPrefix.length);

		if (Yuno.commandMan.isDMCommand(command))
			return Yuno.commandMan.executeDM(Yuno, msg.author, command, msg);
		else
			return msg.reply((dmMessage !== null ? dmMessage : 'I\'m just a bot :\'(. I can\'t answer to you.') + '\nYou can also send !source(s) to get the sources of the bot.');
	}
    
	if (typeof workOnlyOnGuild !== 'undefined' && workOnlyOnGuild !== null && workOnlyOnGuild.id !== msg.guild.id)
		return;

	let msgCnt = msg.content,
		guildPrefix = prefixes[msg.guild.id];

	// switching to default prefix if guild
	if (guildPrefix === null || typeof guildPrefix === 'undefined')
		guildPrefix = defaultPrefix;

	if (msgCnt.indexOf(guildPrefix) === 0) {
		let command = msgCnt.substring(guildPrefix.length);
		Yuno.commandMan.execute(Yuno, msg.member, command, msg);
	}
});

let discordConnected = async function(yuno) {
	discClient = yuno.dC;
	Yuno = yuno;

	prefixes = await Yuno.dbCommands.getPrefixes(Yuno.database);

	// the workOnlyOnGuild future value (if the bot has joined the guild)
	let workOnlyOnGuild_ = discClient.guilds.cache.get(workOnlyOnGuild);

	if (workOnlyOnGuild_ !== null)
		workOnlyOnGuild = workOnlyOnGuild_;

	if (!ONE_TIME_EVENT)
		discClient.on('message', msgEvent);

	ONE_TIME_EVENT = true;
};

module.exports.init = function(Yuno, hotReloaded) {
	if (hotReloaded)
		discordConnected(Yuno);
	else
		Yuno.on('discord-connected', discordConnected);
};

module.exports.configLoaded = function(Yuno, config) {
	let workOnlyOnGuild_ = config.get('debug.work-only-on-guild'),
		defaultPrefix_ = config.get('commands.default-prefix'),
		dmMessage_ = config.get('chat.dm');

	if (typeof workOnlyOnGuild_ === 'string')
		workOnlyOnGuild = workOnlyOnGuild_;

	if (typeof defaultPrefix_ === 'string')
		defaultPrefix = defaultPrefix_;

	if (typeof dmMessage_ === 'string')
		dmMessage = dmMessage_;
};

module.exports.destroy = function() {
    
};
