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

const {MessageEmbed} = require("discord.js");
const urban = require("urban");

module.exports.run = async function(yuno, author, args, msg) {
    if (!args[0]) {
        return msg.channel.send(":negative_squared_cross_mark: Input a search term");
    }
    
    let uInput = args.join(" ");
    let url = `https://www.urbandictionary.com/define.php?term=${uInput}`

    urban(uInput).first(search => {
        if (!search) return msg.channel.send(`No results found for ${uInput}`);
         msg.channel.send(new MessageEmbed()
            .setTitle(search.word)
            .setThumbnail("https://cdn.discordapp.com/attachments/446842126005829632/449800259468525568/urban_dictionary.png")
            .addField(":notebook_with_decorative_cover:Definition", `\`${search.definition}\``)
            .addField(":bookmark_tabs:Example", `\`${search.example}\``)
            .addField(":small_red_triangle:Upvotes", `\`${search.thumbs_up}\``, true)
            .addField(":small_red_triangle_down:Downvotes", `\`${search.thumbs_down}\``, true)
            .addField(":link:URL", `[${search.word}](${url})`)
            .setFooter(`Author - ${search.author}`)
            .setColor(0x9eddf1));
        });
    }

module.exports.about = {
    "command": "urban",
    "description": "Search for a definition on the Urban Dictionary",
    "examples": ["urban anime"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "ub",
    "onlyMasterUsers": false
};