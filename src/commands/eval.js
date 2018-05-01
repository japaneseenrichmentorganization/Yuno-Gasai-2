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

const util = require("util");

module.exports.run = async function(yuno, author, args, msg) {
    let isSilent = args.includes("--silent"),
        code = "";

    if (isSilent)
        args = args.slice(1);

    code = args.join(" ")

    let result = "No return.";
    
    try {
        result = eval("(function() { " + code + "})").bind(yuno)();
        if (result instanceof Promise)
            result = await result;
    } catch(e) {
        result = e.message;
    }

    if (typeof result === "string")
        result = result.replace(new RegExp(Yuno.dC.token, "gi"), "[token]");
    else
        result = util.inspect(result, { depth: 0 });

    if (isSilent && author !== 0)
        msg.delete();
    else
        if (author !== 0)
            msg.channel.send("```js\n " + result + " \n```")
        else
            yuno.prompt.info("Evaluation result:\n" + result);
    
}

module.exports.about = {
    "command": "eval",
    "description": "Evaluates some Javascript code inside the bot, in the context of Yuno's instance.",
    "examples": ["eval console.log(\"Yuno Gasai is okay.\")", "eval --silent something() // Will delete the message & send no result"],
    "discord": true,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "onlyMasterUsers": true
}
