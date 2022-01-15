import { Connection, IDatabaseDriver, MikroORM } from '@mikro-orm/core';
import {
	ApplicationCommandDataResolvable,
	Client,
	ClientPresence,
	Collection,
} from 'discord.js';
import { Job } from 'node-schedule';
import { CommandType } from './Command';

export interface RegisterCommandsOptions {
	guildId?: string;
	commands: ApplicationCommandDataResolvable[];
}
export interface Settings{
	prefix: string;
	onJoinDMMsg: string;
	onJoinDMMsgTitle: string;
	spamFilter: boolean;
	measureXP: boolean;
	levelRoleMap: Map<string,string>;
}
export interface BotConfig {
	chat: {
		xpPerMsg: number,
		dmResponse: string,
		missingPermissions: string
	}
	botToken: string;
	commands: {
		admins: Array<string>;
		prefix: string;
		permissions: Array<{
			name: string;
			id: string;
			type: string;
			permission: boolean;
		}>
	},
	ban: {
		defaultImage: string
	},
	errors: {
		mentionwhencrash: Array<string>,
		channel: string;
	},
	database: string;
	guildID: string;
	spam: {
		maxWarnings: number;
	},
	discordPresence: ClientPresence | null;
}
export interface ExtendedClient extends Client {
	commands: Collection<string, CommandType>;
	slashCommands: Array<ApplicationCommandDataResolvable>;
	channelsToClean: Collection<string, Job>;
	cooldowns: Collection<string, Collection<string, number>>;
	guildID: string;
	orm: MikroORM<IDatabaseDriver<Connection>>;
	settings: Settings;
	config: BotConfig;
	start(BOT_CONFIG: BotConfig): void;
	importFile(filePath: string): Promise<unknown>;
	registerCommands(): Promise<void>;
	registerModules(): Promise<void>;
	registerCleaningJobs(): Promise<void>;
}