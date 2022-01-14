import { Event } from '../lib/Event';
import { CommandType } from '../interfaces/Command';
import { ExtendedClient } from '../interfaces/Client';
import { Collection, PermissionResolvable, TextChannel } from 'discord.js';

// Non slash commands
export default new Event('messageCreate', async (message) => {
	// Channel Input Commands TYPE: MESSAGE
	// We don't need to waste execution time if its an interaction
	if (message.interaction || message.author.bot) return;
	const client: ExtendedClient = message.client as ExtendedClient;
	// This evades the bot from being triggered by @everyone
	const mentioned: boolean = message.content
		.trim()
		.startsWith('<@&927890124111495179>');
	// Check if commands has prefix and its not another bot
	if (
		(message.content.trim().startsWith(client.settings.prefix) ==
			mentioned) !==
		(message.content.includes('@here') ||
			message.content.includes('@everyone') ||
			message.type == 'REPLY')
	) {
		return;
	}
	// Command args, command name and Command itself
	const args = mentioned
		? message.content.slice('<@&927890124111495179>'.length).split(/ +/)
		: message.content.slice(client.settings.prefix.length).split(/ +/);
	const commandName = args.shift()?.toLowerCase() || '';
	const command: CommandType | undefined =
		client.commands.get(commandName) ?? undefined;
	// Needs to be checked early to prevent useles code excution
	if (
		!command ||
		(command.isAdminOnly &&
			!client.config.commands.admins.includes(message.author.id))
	) {
		message.reply(
			`There is no such command: ${client.settings.prefix}${commandName}`
		);
		return;
	}
	// Checks if the command is guild only and that it is a text channel or if command isSlash
	if (
		(command.guildOnly && message.channel.type == 'GUILD_TEXT') ||
		command.isSlash
	) {
		message.reply('');
		return;
	}
	// check for args requirements and gives usage if usage is specified
	if (command.isArgumentsRequired && !args.length) {
		let reply = `@${message.author.username}#${message.author.tag} You have to give me something to work with!`;

		if (command.usage) {
			reply += `\nUsage: \`${client.settings.prefix}${command.name} ${command.usage}\``;
		}

		message.reply(reply);
		return;
	}
	// commands that require certain discord permissions
	if (command.requiredPermissions) {
		const authorPermissions = (
			message.channel as TextChannel
		).permissionsFor(message.author);

		if (
			!authorPermissions ||
			!authorPermissions.has(
				command.requiredPermissions as PermissionResolvable[]
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
			commandUserRoles.includes(role.name)
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

	// After that we can safely execute the command
	await command.run({
		client: client as ExtendedClient,
		message: message,
		params: args,
	});
});
