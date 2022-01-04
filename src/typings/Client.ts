import { ApplicationCommandDataResolvable, Client, Collection } from 'discord.js';
import { CommandType } from './Command';

export interface RegisterCommandsOptions {
	guildId?: string;
	commands: ApplicationCommandDataResolvable[];
}
export interface ExtendedClient extends Client {
	commands: Collection<string, CommandType>
	start(): void
	importFile(filePath: string): Promise<unknown>
	registerCommands({ commands, guildId }: RegisterCommandsOptions): Promise<void>
	registerModules(): Promise<void>
}