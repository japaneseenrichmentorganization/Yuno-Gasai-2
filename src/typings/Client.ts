import { Connection, IDatabaseDriver, MikroORM } from '@mikro-orm/core';
import {
	ApplicationCommandDataResolvable,
	Client,
	Collection,
} from 'discord.js';
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
export interface ExtendedClient extends Client {
	commands: Collection<string, CommandType>;
	slashCommands: Array<ApplicationCommandDataResolvable>;
	guildID: string | undefined;
	orm: MikroORM<IDatabaseDriver<Connection>> | undefined;
	settings: Settings;
	start(token: string,guildID: string): void;
	importFile(filePath: string): Promise<unknown>;
	registerCommands(): Promise<void>;
	registerModules(): Promise<void>;
}
