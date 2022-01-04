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
import { Yuno } from './src/Yuno';
(async () => {
	try {
        console.log('Starting Yuno-Gasai-2');
        // Creates a new Yuno instance, a guild ID must be passed
		const instance = new Yuno('');
		await instance.start(
			''
		);
        // Sets a listeners for easier debugging
        if (process.env.NODE_ENV !== 'production') {
            process.on('uncaughtException', (err) => {
                console.log('\x1b[35m', 'Stack-Trace: ' + err.stack);
            });
        
            process.on('unhandledRejection', (err: unknown) => {
                console.log(
                    '\x1b[35m',
                    'Stack-Trace: ' + (err instanceof Error ? err.stack : '')
                );
            });
        }
        process.on('warning', (warn: Error) =>{
            console.log('\x1b[35m', warn.name);
            console.log('\x1b[35m', warn.message);
            console.log('\x1b[35m', warn.stack);
            process.exit(1);
        })
	} catch (e: unknown) {
		//Critical error probably no token and no guildid
        console.error(`Critical error: ${e instanceof Error ? e.stack : e}`)
	}
})();
