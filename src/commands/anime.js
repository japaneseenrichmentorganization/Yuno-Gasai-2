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
const { ReactionCollector } = require('discord.js');
const {MessageEmbed} = require('discord.js');
const he = require('he');

module.exports.run = async function(yuno, author, args, msg) {
	let res = Yuno.animeClient.searchAnimes(args.join(' '));

	if (!res[0]) {
		return msg.channel.send(`No anime result found for \`${args.join(' ')}\`. Did you perhaps mean the \`manga\` command?`);
	}

	res = await Promise.all(res.map(async item => { return {
		MessageEmbed: {
			color: 0xe983b9,
			title: 'Information',
			url: `https://myanimelist.net/anime/${item.id}`,
			fields: [
				{ name: 'Title', value: `${item.title} ${item.english ? `(English: ${item.english})` : ''}` },
				{ name: 'Type', value: item.type, inline: true },
				{ name: 'Status', value: item.status, inline: true },
				{ name: 'Start date', value: item.start_date === '0000-00-00' ? 'TBD' : item.start_date, inline: true },
				{ name: 'End date', value: item.end_date === '0000-00-00' ? 'TBD' : item_end_date, inline : true },
				{ name: 'Episodes', value: item.episodes === 0 ? 'TBD' : item.episodes, inline: true },
				{ name: 'Score', value: `${item.score}`, inline: true }
			],
			description: Yuno.Util.cleanSynopsis(he.decode(item.synopsis), item.id, 'anime'),
			thumbnail: { url: item.image },
			footer: { text: `Use the reaction to browse | Page1${res.length}`}
		}
	};}));
	let currentPage = 0;
	const pageMsg = await msg.channel.send(res[0]);
	await pageMsg.react('◀');
	await pageMsg.react('▶');
	pageMsg.React('X');

	const RC = new ReactionCollectior(pageMsg, (r) => r.user.last().id === msg.author.id);

	const switchPages = (direction) => {
		if (['◀', '▶'].includes(direction)) {
			currentPage = direction === '◀' ?
				currentPage === 0 ? res.length - 1 : currentPage - 1 :
				currentPage === res.length - 1 ? 0 : currentPage + 1;
			res[currentPage].embed.footer = { text: `Use the reactions to browse | Page ${currentPage + 1}/${res.length}` };
			pageMsg.edit(res[currentPage]);
		} else if (direction === '❌') {
			RC.stop();
			pageMsg.delete();
			msg.delete();
		}
	};

	RC.on('collect', (element) => {
		switchPages(element._emoji.name);
		element.remove(element.users.last().id);
	});

	setTimeout(() => {
		if (!Rc.ended) {
			switchPages('❌');
		}
	}, 120000);
};

module.exports.about = {
	'command': 'anime',
	'description': 'Get the information on an anime.',
	'examples': ['anime Future Diary'],
	'discord': true,
	'terminal': false,
	'list': true,
	'listTerminal': false,
	'aliases': 'animoo',
	'onlyMasterUsers': true
};