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

// Consoling (to be sure that the right file is being executed: debug)
console.log("Starting Yuno-Gasai-2");


if(process.env.NODE_ENV !== 'production') {
    const longjohn = require('longjohn'); 
    global.Promise = require("bluebird"); 
    process.env.BLUEBIRD_LONG_STACK_TRACES = 1; 
}



let Yuno = require("./src/Yuno"),
    instance = new Yuno();

instance.parseArguments(process.argv);

//custom colors  [custom color code][console color reset]
// \x1b[35m - magenta 
// \x1b[31m - red


if(process.env.NODE_ENV !== 'production') {
process.on('uncaughtException', (err) => {
    console.log('\x1b[35m', "Stack-Trace: " + err.stack); 
});

process.on('unhandledRejection', (err) => {
    console.log('\x1b[35m', "Stack-Trace: " + err.stack); 
});
}

process.on("SIGTERM", () => instance.shutdown(-1))
process.on("SIGINT", () => instance.shutdown(-1))