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
const { ReactionCollector, EmbedBuilder } = require('discord.js');

module.exports.run = async function(yuno, author, args, msg) {
    let res = Yuno.animeClient.searchMangas(args.join(' '));

    if (!res[0]) {
        return msg.channel.send(`No manga result found for \`${args.join(' ')}\`. Did you perhaps mean the \`anime\` command?`);
    }

    res = await Promise.all(res.map(async item => {
        const embed = new EmbedBuilder()
            .setColor(0xe983b9)
            .setTitle('Information')
            .setURL(`https://myanimelist.net/manga/${item.id}`)
            .addFields([
                { name: 'Title', value: `${item.title} ${item.english ? `(English: ${item.english})` : ''}` },
                { name: 'Type', value: item.type, inline: true },
                { name: 'Status', value: item.status, inline: true },
                { name: 'Start date', value: item.start_date === '0000-00-00' ? 'TBD' : item.start_date, inline: true },
                { name: 'End date', value: item.end_date === '0000-00-00' ? 'TBD' : item.end_date, inline: true },
                { name: 'Chapters', value: item.chapters === 0 ? 'TBD' : item.volumes, inline: true },
                { name: 'Volumes', value: item.episodes === 0 ? 'TBD' : item.volumes, inline: true },
                { name: 'Score', value: `${item.score}`, inline: true }
            ])
            .setDescription(Yuno.Util.cleanSynopsis(Yuno.Util.decodeHTML(item.synopsis), item.id, 'manga'))
            .setThumbnail(item.image)
            .setFooter({ text: `Use the reactions to browse | Page 1/${res.length}`});
        return embed;
    }));
    let currentPage = 0;
    const pageMsg = await msg.channel.send({embeds: [res[0]]});
    await pageMsg.react('◀');
    await pageMsg.react('▶');
    await pageMsg.react('❌');

    const RC = new ReactionCollector(pageMsg, { filter: (r, u) => u.id === msg.author.id });

    const switchPages = (direction) => {
        if (['◀', '▶'].includes(direction)) {
            currentPage = direction === '◀' ?
                currentPage === 0 ? res.length - 1 : currentPage - 1 :
                currentPage === res.length - 1 ? 0 : currentPage + 1;
            res[currentPage].setFooter({ text: `Use the reactions to browse | Page ${currentPage + 1}/${res.length}` });
            pageMsg.edit({embeds: [res[currentPage]]});
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
        if (!RC.ended) {
            switchPages('❌');
        }
    }, 120000);
};

module.exports.about = {
    "command": "manga",
    "description": "Get the information on an manga.",
    "examples": ["manga Future Diary"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "animoo",
    "onlyMasterUsers": true
}