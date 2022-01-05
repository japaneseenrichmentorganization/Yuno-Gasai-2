import { Event } from '../lib/Event';
import { CommandType } from '../typings/Command';
import { ExtendedClient } from '../typings/Client';
import {
	Collection,
	CommandInteractionOptionResolver,
	TextChannel,
} from 'discord.js';

// Non slash commands
export default new Event('messageCreate', async (message) => {
	// Channel Input Commands TYPE: MESSAGE
	const client: ExtendedClient = message.client as ExtendedClient;
	// Check if commands has prefix and its not another bot
	if (
		!message.content.trim().startsWith(client.settings.prefix) ||
		message.author.bot
	) {
		return;
	}
	// Command args, command name and Command itself
	const args = message.content
		.slice(client.settings.prefix.length)
		.split(/ +/);
	const commandName = args.shift()?.toLowerCase() || '';
	const command: CommandType | undefined =
		client.commands.get(commandName) ?? undefined;
	// Needs to be checked early to prevent useles code excution
	if (!command || (command.isAdminOnly && !client.config.commands.admins.includes(message.author.id))) {
		message.reply(
			`There is no such command: \`${client.settings.prefix}${commandName}`
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
			!authorPermissions.has(command.requiredPermissions)
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
			message.reply(
				`por favor espere ${timeLeft.toFixed(
					1
				)} segundo(s) antes de reusar o comando \`${command.name}\``
			);
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
