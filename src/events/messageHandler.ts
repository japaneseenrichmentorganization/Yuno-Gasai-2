import { Event } from '../lib/Event';
import { CommandType } from '../interfaces/Command';
import { ExtendedClient } from '../interfaces/Client';
import { processCommands } from '../lib/commandsManager';
// Non slash commands
export default new Event('messageCreate', async (message) => {
	// checks if the bot has booted(initialized)
	if (!(message.client as ExtendedClient).booted) return;
	// We don't need to waste execution time if its an interaction
	if (message.interaction || message.author.bot) return;
	const client: ExtendedClient = message.client as ExtendedClient; // shorthand for message.client
	// Command checking
	const mentionString = '@' + client.user?.username;
	const cleanContent = message.cleanContent;
	const splitContent = cleanContent.trim().split(/ +/);
	let isCommand = false;
	// Was the bot mentioned
	const mentioned: boolean =
		splitContent.filter((e) => e == mentionString).length == 1;
	if (mentioned || message.content.startsWith(client.settings.prefix, 0)) {
		const args = mentioned
			? splitContent.filter((e) => e !== mentionString)
			: cleanContent.slice(client.settings.prefix.length).trim().split(/ +/);
		// Command args, command name and Command itself
		const commandName = args.shift()?.toLowerCase() || '';
		const command: CommandType | undefined =
			client.commands.get(commandName) ?? undefined;
		if (!command)
			message.reply(
				`There is no such command: ${client.settings.prefix}${commandName}`,
			);
		else {
			isCommand = true;
			await processCommands(message, command as CommandType, args, client);
		}
	}
	// Execute every messageProcessor that ignores commands
	client.messageProcessors.forEach((messageProcessor) => {
		try {
			if (isCommand) {
				if (!messageProcessor.ignoreCommands) messageProcessor.process(message);
			} else messageProcessor.process(message);
		} catch (error) {
			console.log(error);
		}
	});
});
