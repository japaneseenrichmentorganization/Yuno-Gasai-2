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
console.log('Starting Yuno-Gasai-2. Head-dumping every 10 seconds');

let heapdump = require('heapdump');

setInterval(function() {
	console.log('\nDumping');
	heapdump.writeSnapshot(function(err, filename) {
		if (err)
			console.log('Error while writing the dump', err);
		else
			console.log('Dump file written as', filename);
	});
}, 10000);

let Yuno = require('./src/Yuno'),
	instance = new Yuno();

instance.parseArguments(process.argv);

process.on('SIGTERM', () => instance.shutdown(-1));
process.on('SIGINT', () => instance.shutdown(-1));
