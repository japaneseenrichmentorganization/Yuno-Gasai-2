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

// Self-contained regex escaper — avoids relying on RegExp.escape which is only
// available as an experimental feature in recent Node.js builds.
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAX_RESULT_LENGTH = 1800; // keep under Discord's 2000-char message limit

module.exports.run = async function(yuno, author, args, msg) {
    let isSilent = args.includes("--silent"),
        code = "";

    if (isSilent)
        args = args.slice(1);

    code = args.join(" ");

    // Audit every eval invocation regardless of outcome.
    const invoker = author !== 0
        ? `${author.user?.tag ?? author.id} (${author.id})`
        : "terminal";
    yuno.prompt.warning(`[AUDIT] eval executed by ${invoker} | code: ${code.substring(0, 200)}`);

    let result = "No return.";

    try {
        result = eval("(function() { " + code + "})").bind(yuno)();
        if (result instanceof Promise)
            result = await result;
    } catch(e) {
        result = e.message;
    }

    // Always stringify first, then scrub the token regardless of result type.
    // Using `depth: 2` so objects are inspected deeply enough to catch token
    // values stored inside nested properties.
    const raw = typeof result === "string" ? result : util.inspect(result, { depth: 2 });
    const token = yuno.dC.token;
    const sanitized = token
        ? raw.replace(new RegExp(escapeRegex(token), "gi"), "[token]")
        : raw;

    // Truncate to avoid hitting Discord's character limit.
    const output = sanitized.length > MAX_RESULT_LENGTH
        ? sanitized.substring(0, MAX_RESULT_LENGTH) + "\n… (truncated)"
        : sanitized;

    if (isSilent && author !== 0) {
        msg.delete();
    } else if (author !== 0) {
        msg.channel.send("```js\n " + output + " \n```");
    } else {
        yuno.prompt.info("Evaluation result:\n" + output);
    }

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
