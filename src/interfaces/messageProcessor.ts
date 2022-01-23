import { Message } from 'discord.js';

type ProcessFunction = (message: Message) => void | Promise<void>;

export interface MessageProcessorType {
	name: string;
	ignoreCommands: boolean;
	process: ProcessFunction;
}
