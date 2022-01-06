import {
	ApplicationCommandDataResolvable,
	Client,
	ClientEvents,
	Collection,
} from 'discord.js';
import glob from 'glob';
import { promisify } from 'util';

import { BotConfig, ExtendedClient, Settings } from './typings/Client';
import { Event } from './lib/Event';
import { CommandType } from './typings/Command';
import { Connection, IDatabaseDriver, MikroORM } from '@mikro-orm/core';
import dbConfig from './config/mikro-orm.config';
import { Guilds } from './entities';
import { ApplicationCommandPermissionTypes } from 'discord.js/typings/enums';
// Used for importing commands and events asyncly
const globPromise = promisify(glob);

export class Yuno extends Client implements ExtendedClient {
	// properties
	public commands: Collection<string, CommandType>;
	public slashCommands: Array<ApplicationCommandDataResolvable>;
	public cooldowns: Collection<string, Collection<string, number>>;
	public guildID!: string;
	// Settings from the database
	public settings!: Settings;
	public orm!: MikroORM<IDatabaseDriver<Connection>>;
	// Settings from the config file needs to be reworked
	public config!: BotConfig;
	constructor() {
		// All intents 32767
		super({ intents: 32767 });
		this.commands = new Collection<string, CommandType>();
		this.slashCommands = new Array<ApplicationCommandDataResolvable>();
		this.cooldowns = new Collection<string, Collection<string, number>>();
	}

	async start(BOT_CONFIG: BotConfig) {
		this.guildID = BOT_CONFIG.guildID;
		this.config = BOT_CONFIG;
		// Register modules, login afterwards and register the on
		await this.registerModules();
		//register all commands once the bot is ready
		this.on('ready', async () => {
			await this.registerCommands().then(() => this.setPermissions());
		});
		// logs the bot in
		await this.login(BOT_CONFIG.botToken);
		// inits the orm db object
		// REWORK CONFIG
		dbConfig.dbName = BOT_CONFIG.database;
		this.orm = await MikroORM.init(dbConfig);
		// parses the settings data from the db into settings property
		await this._parseSettings();
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
	async setPermissions() {
		const commands = await this.guilds.cache.get(this.guildID)?.commands.fetch();
		this.config.commands.permissions.forEach((permission) => {
		commands!.map((command) => {					
					if (command.name == permission.name) {
						command.permissions.add({
							permissions: [
								{
									id: permission.id,
									type: permission.type as 'USER' | 'ROLE',
									permission: permission.permission,
								},
							],
						});
					}
				});
		});
	}
	async registerModules() {
		// Commands
		const commandFiles = await globPromise(`${__dirname}/commands/*.js`);
		commandFiles.forEach(async (filePath) => {
			const command: CommandType = await this.importFile(filePath);
			if (!command.name) return;
			command.isSlash
				? this.slashCommands.push(command)
				: this.commands.set(command.name, command);
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
	async _parseSettings() {
		// Parses the data from the db into the settings type object,
		// if a value isnt set a default value the for given type is set, e.g false for boolean.
		// Needs to be called after connecting to the database, get all guilds but we only one so using index 0 is safe
		const rawSetting = await this.orm.em.getRepository(Guilds).findAll();
		// Due to the database being setup in a weird way we need to do some cast magic
		// As the types are TEXT in the database casting like this is safe
		this.settings = {
			levelRoleMap:
				(rawSetting[0].levelRoleMap as unknown as Map<
					string,
					string
				>) ?? new Map<string, string>(),
			measureXP: (rawSetting[0].measureXP as unknown as boolean) ?? false,
			spamFilter:
				(rawSetting[0].spamFilter as unknown as boolean) ?? false,
			// These followering properties are just string so no casting needed
			onJoinDMMsg: rawSetting[0].onJoinDMMsg ?? '',
			onJoinDMMsgTitle: rawSetting[0].onJoinDMMsgTitle ?? '',
			prefix: rawSetting[0].prefix ?? this.config.commands.prefix,
		};
	}
}
