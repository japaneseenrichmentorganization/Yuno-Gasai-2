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

const FAIL_COLOR = '#ff0000';
const SUCCESS_COLOR = '#43cc24';

// hot-reload things
delete require.cache[require.resolve('../lib/EmbedCmdResponse')];

const {GuildMember} = require('discord.js'),
	EmbedCmdResponse = require('../lib/EmbedCmdResponse');

module.exports.run = async function(yuno, author, args, msg) {
	args = args.join(' ');

	let reason = '',
		toBanIds = [],
		mutli;

	if (args.includes('|')) {
		reason = (args.split('|')[1] + ' / Kicked by ' + msg.author.tag).trim();
		args = args.split('|')[0];
	} else {
		reason = 'Kicked by ' + msg.author.tag;
	}

	let toBanThings = args.split(' '),
		userMentions = msg.mentions.users.array();

	for(let i = 0; i < toBanThings.length; i++) {
		let e = toBanThings[i];
		if (!(e.indexOf('<') > -1) && e.trim() != '') {
			let wantedUser = await msg.guild.members.fetch(e);

			if (wantedUser)
				userMentions.push(wantedUser);
			else
				msg.channel.send(new EmbedCmdResponse()
					.setColor(FAIL_COLOR)
					.setTitle(':negative_squared_cross_mark: Kick failed.')
					.setDescription(':arrow_right: Failed to kick user with id', e, ': User with this ID wasn\'t found in the server.')
					.setCMDRequester(msg.member));
		}
	}

	if (userMentions.size !== 0)
		userMentions.forEach(async u => {
			let target = await msg.guild.members.fetch(u.id);

			if (msg.guild.member(target).id === msg.author.id)
				return msg.channel.send(new EmbedCmdResponse()
					.setColor(FAIL_COLOR)
					.setTitle(':negative_squared_cross_mark: Kick failed.')
					.setDescription(':arrow_right: You can also leave the server instead of kicking yourself ;)')
					.setCMDRequester(msg.member));

			if (!yuno.commandMan._isUserMaster(msg.author.id) && msg.member.roles.highest.comparePositionTo(msg.guild.members.get(target.id).roles.highest) <= 0)
				return msg.channel.send(new EmbedCmdResponse()
					.setColor(FAIL_COLOR)
					.setTitle(':negative_squared_cross_mark: Kick failed.')
					.setDescription(':arrow_right: Failed to kick user ' + target.user.tag + '. The user has a higher or the same hierarchy than you.')
					.setCMDRequester(msg.member));


			msg.guild.members.resolve(target.id).kick({
				'days': 1,
				'reason': reason
			}).then(function() {
				msg.channel.send(new EmbedCmdResponse()
					.setColor(SUCCESS_COLOR)
					.setTitle(':white_check_mark: Kick successful.')
					.setDescription(':arrow_right: User', target.user.tag, 'has been successfully kicked.')
					.setCMDRequester(msg.member));
			}).catch(function(err) {
				msg.channel.send(new EmbedCmdResponse()
					.setColor(FAIL_COLOR)
					.setTitle(':negative_squared_cross_mark: Kick failed.')
					.setDescription(':arrow_right: Failed to kick', target.user.tag, ':', err.message)
					.setCMDRequester(msg.member));
			});
		});
};

module.exports.about = {
	'command': 'kick',
	'description': 'Kick an user',
	'examples': ['kick <id> [anotherid] | reason', 'kick @someone [id] [againananotherid] | reason',
		'kick @someone'],
	'discord': true,
	'terminal': false,
	'list': true,
	'listTerminal': false,
	'requiredPermissions': ['KICK_MEMBERS'],
	'aliases': []
};