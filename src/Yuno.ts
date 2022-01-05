import {
	ApplicationCommandDataResolvable,
	Client,
	ClientEvents,
	Collection,
} from 'discord.js';
import glob from 'glob';
import { promisify } from 'util';

import { ExtendedClient } from './typings/Client';
import { Event } from './lib/Event';
import { CommandType } from './typings/Command';
import { Connection, IDatabaseDriver, MikroORM } from '@mikro-orm/core';
import config from './config/mikro-orm.config';
// Used for importing commands and events asyncly
const globPromise = promisify(glob);

export class Yuno extends Client implements ExtendedClient {
	public commands: Collection<string, CommandType>;
	public slashCommands: Array<ApplicationCommandDataResolvable>;
	public guildID: string | undefined;
	orm: MikroORM<IDatabaseDriver<Connection>> | undefined;
	constructor() {
		// All intents 32767
		super({ intents: 32767 });
		this.commands = new Collection<string, CommandType>();
		this.slashCommands = new Array<ApplicationCommandDataResolvable>();
	}

	async start(token: string, guildID: string) {
		this.guildID = guildID;
		// Register modules, login afterwards and register the on
		await this.registerModules();
		//register all commands once the bot is ready
		this.on('ready', async () => {
			await this.registerCommands();
		});
		await this.login(token);
		this.orm = await MikroORM.init(config);
	}

	async importFile(filePath: string) {
		return (await import(filePath))?.default;
	}

	async registerCommands() {
		if (this.guildID) {
			this.guilds.cache
				.get(this.guildID)
				?.commands.set(this.slashCommands);
			console.log(`Registering commands to ${this.guildID}`);
		} else {
			console.log('Registering global commands');
			process.emitWarning('No guildID', {
				code: 'GLOBAL_NOTALLOWED',
				detail: 'Global commands are not supported',
			});
		}
	}

	async registerModules() {
		// Commands
		const commandFiles = await globPromise(`${__dirname}/commands/*.js`);
		commandFiles.forEach(async (filePath) => {
			const command: CommandType = await this.importFile(filePath);
			if (!command.name) return;
			console.log(command);

			this.commands.set(command.name, command);
			this.slashCommands.push(command);
		});
		// Event
		const eventFiles = await globPromise(`${__dirname}/events/*.js`);
		eventFiles.forEach(async (filePath) => {
			const event: Event<keyof ClientEvents> = await this.importFile(
				filePath
			);
			this.on(event.event, event.run);
		});
	}
}
