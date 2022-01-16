import { Role, TextChannel } from 'discord.js';
import { Experiences } from '../entities';
import { ExtendedClient } from '../interfaces/Client';
import { CommandType } from '../interfaces/Command';
import { Event } from '../lib/Event';

export default new Event('messageCreate', async (message) => {
	// checks if the bot has booted(initialized)
	if (!(message.client as ExtendedClient).booted) return;
	// Channel Input Commands TYPE: MESSAGE
	// A user shouldn't get xp for interaction neither should a bot get xp and its obviously guild only
	if (
		message.interaction ||
		message.author.bot ||
		message.channel.type !== 'GUILD_TEXT'
	)
		return;
	// Is xp enabled
	if (!(message.client as ExtendedClient).settings.measureXP) return;
	const client: ExtendedClient = message.client as ExtendedClient; // shorthand for message.client
	// Basically the same checks as CommandManager as we need to check that the message isn't a command
	const mentioned: boolean = message.content
		.trim()
		.startsWith('<@&' + client.user?.id + '>');
	// Command args, command name and Command itself
	const args = mentioned
		? message.content.slice(('<@&' + client.user?.id + '>').length).split(/ +/) // if the bot itself is mentioned
		: message.content.slice(client.settings.prefix.length).split(/ +/);
	const commandName = args.shift()?.toLowerCase() || '';
	const command: CommandType | undefined =
		client.commands.get(commandName) ?? undefined;
	if (command) return;
	const rolemap = client.settings.levelRoleMap;
	const xpPerMsg = client.config.chat.xpPerMsg || 1;
	const xpRepository = await client.orm.em.getRepository(Experiences);
	// Now we can add xp to the author
	const xpForUser = await xpRepository.findOne({
		guildID: message.guildId,
		userID: message.author.id,
	});
	if (!xpForUser) {
		return xpRepository.persistAndFlush(
			xpRepository.create({
				exp: xpPerMsg,
				guildID: message.guildId,
				level: 0,
				userID: message.author.id,
			}),
		);
	}
	const neededXP =
		5 * Math.pow(parseInt(xpForUser.level), 2) +
		50 * parseInt(xpForUser.level) +
		100;
	xpForUser.exp += xpPerMsg;

	if (xpForUser.exp >= neededXP) {
		xpForUser.level += 1;
		xpForUser.exp -= neededXP;
	}
	console.log(xpForUser.exp);
	await xpRepository.persistAndFlush(xpForUser);
	if (rolemap[xpForUser.level] !== 'string')
		return console.log('ROle not there');
	const role = message.guild?.roles.cache.get(rolemap[xpForUser.level]);
	if (!role) return console.log('ROle not there');
	message.member?.roles.add(role);
});
