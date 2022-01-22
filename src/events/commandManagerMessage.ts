import { Event } from '../lib/Event';
import { CommandType, RunFunction, RunOptions } from '../interfaces/Command';
import { ExtendedClient } from '../interfaces/Client';
import {
	Collection,
	PermissionResolvable,
	TextChannel,
	Formatters,
} from 'discord.js';

// Non slash commands
export default new Event('messageCreate', async (message) => {
	// checks if the bot has booted(initialized)
	if (!(message.client as ExtendedClient).booted) return;
	// Channel Input Commands TYPE: MESSAGE
	// We don't need to waste execution time if its an interaction
	if (message.interaction || message.author.bot) return;
	const client: ExtendedClient = message.client as ExtendedClient; // shorthand for message.client
	const mentionString = '@' + client.user?.username;
	const cleanContent = message.cleanContent;
	// Was the bot mentioned
	const mentioned: boolean = cleanContent
		.trim()
		.includes('@' + client.user?.username);
	if (!mentioned && !message.content.startsWith(client.settings.prefix)) {
		console.log(
			!mentioned && !message.content.startsWith(client.settings.prefix),
		);
		return;
	}
	const mentionedAtStart: string[] | undefined = cleanContent
		.trim()
		.startsWith(mentionString)
		? cleanContent.slice(mentionString.length).trim().split(/ +/)
		: undefined;
	const mentionedAtEnd: string[] | undefined = cleanContent
		.trim()
		.endsWith(mentionString)
		? cleanContent
			.slice(0, cleanContent.length - mentionString.length)
			.trim()
			.split(/ +/)
		: undefined;
	// Command args, command name and Command itself
	const args =
		mentionedAtStart ||
		mentionedAtEnd ||
		message.content.slice(client.settings.prefix.length).split(/ +/);
	console.log(args);
	const commandName = args.shift()?.toLowerCase() || '';
	const command: CommandType | undefined =
		client.commands.get(commandName) ?? undefined;
	// Needs to be checked early to prevent useless code execution
	if (
		!command ||
		(command.isAdminOnly &&
			!client.config.commands.admins.includes(message.author.id)) // we pretend the command doesn't exist, this reduces the attack surface
	) {
		message.reply(
			`There is no such command: ${client.settings.prefix}${commandName}`,
		);
		return;
	}
	// Checks if the command is guild only and that it is a text channel
	if (!(command.guildOnly && message.channel.type == 'GUILD_TEXT')) {
		message.reply('Guild only');
		return;
	}
	// check for args requirements and gives usage if usage is specified
	if (command.isArgumentsRequired && !args.length) {
		let reply: string = Formatters.userMention(message.author.id) + ' ';
		if (command.missingArgumentsResponse) {
			reply += command.missingArgumentsResponse;
		} else {
			reply += ' You have to give me something to work with!';
		}

		if (command.usage) {
			reply += `\nUsage: \`${client.settings.prefix}${command.name} ${command.usage}\``;
		}

		message.reply(reply);
		return;
	}
	// checks if the command is a class command and checks if the class has a function that maps to the first arg given
	let runMethode: RunFunction = command.run;
	if (command.isClass) {
		if (command.subCmdsName?.includes(args[0])) {
			runMethode = command[args[0]] as RunFunction;
			args.shift();
		} else {
			message.reply(`Unknown subcommand ${args[0]} of command ${command.name}`);
			return;
		}
	}
	// commands that require certain discord permissions
	if (command.requiredPermissions) {
		const authorPermissions = (message.channel as TextChannel).permissionsFor(
			message.author,
		);

		if (
			!authorPermissions ||
			!authorPermissions.has(
				command.requiredPermissions as PermissionResolvable[],
			)
		) {
			message.reply('');
			return;
		}
	}
	// commands that require certain roles
	if (command.requiredRoles) {
		const { requiredRoles: commandUserRoles } = command;
		const hasRole = message.member?.roles.cache.some((role) =>
			commandUserRoles.includes(role.name),
		);
		if (!hasRole) {
			message.reply(`${commandUserRoles.join(', ')}`);
			return;
		}
	}

	// command delay to avoid spamming YAAAS thats right cooldowns are a thing now
	if (!client.cooldowns?.has(command.name)) {
		client.cooldowns?.set(command.name, new Collection());
	}
	const now = Date.now();
	// get cooldown(s) for current command can be null
	const timestamps = client.cooldowns?.get(command.name);
	const cooldownAmount = (command.cooldown || 3) * 1000;

	if (timestamps?.has(message.author.id)) {
		const expirationTime =
			(timestamps.get(message.author.id) ?? 0) + cooldownAmount;

		if (now < expirationTime) {
			const timeLeft = (expirationTime - now) / 1000;
			message.reply(` ${timeLeft.toFixed(1)}\`${command.name}\``);
			return;
		}
	}
	timestamps?.set(message.author.id, now);
	setTimeout(() => timestamps?.delete(message.author.id), cooldownAmount);

	// After that we can safely try to execute the command
	try {
		runMethode.call(command, {
			client: client as ExtendedClient,
			message: message,
			params: args,
		} as RunOptions);
	} catch (error) {
		console.log(error);
		message.reply(`An error occurred ${error}`);
	}
});
