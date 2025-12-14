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

// Use Set for O(1) lookup instead of array O(n)
const BANNED_SEARCH = new Set(["loli", "gore", "guro", "scat", "small_breast", "vore", "underage", "shota"]);

function getRandomsFromArray(sourceArray, count) {
    return Array.from({ length: count }, () =>
        sourceArray[Math.floor(Math.random() * sourceArray.length)]
    );
}

module.exports.run = async function(yuno, author, args, msg) {
    if (!msg.channel.nsfw) {
        return msg.channel.send('I don\'t think I\'m allowed to post those here... Maybe try a NSFW marked channel?');
    }

    let targetPosts = 2;
    if (parseInt(args[0], 10)) {
        targetPosts = parseInt(args[0], 10);
        if (targetPosts < 1 || targetPosts > 25) {
            return msg.channel.send("You cannot request less than 1 or over 25 results");
        }
        args.shift();
    }

    let url = 'https://rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=100';
    url += args[0] ? `&tags=${args[0]}` : `&pid=${Math.ceil(Math.random() * 2000)}`;

    let res;
    try {
        const response = await fetch(url);
        const text = await response.text();
        res = JSON.parse(text);
    } catch (e) {
        return msg.channel.send(`No search results found for \`${args[0]}\`. Please try a different query.`);
    }

    // Use .some() instead of .every() with break pattern
    const cleanMsg = msg.content.toLowerCase().replace(/[^a-z]/gi, '');
    const hasBannedTerm = [...BANNED_SEARCH].some(term => cleanMsg.includes(term));

    if (hasBannedTerm) {
        msg.delete().catch(() => {});
        msg.channel.send(`That is against the Discord ToS. I will not search for that ${msg.author.id}`).catch(() => {});
        return;
    }

    const images = getRandomsFromArray(res.map(i => [i.image, i.directory]), targetPosts);

    // Send in batches of 4
    for (let i = 0; i < images.length; i += 4) {
        const batch = images.slice(i, i + 4);
        await msg.channel.send(batch.map(x => `https://img.rule34.xxx/images/${x[1]}/${x[0]}`));
    }
}

module.exports.about = {
    "command": "hentai",
    "description": "Get some anime girls",
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "hen",
}