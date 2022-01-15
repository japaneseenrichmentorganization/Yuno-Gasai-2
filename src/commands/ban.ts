import { Message, MessageEmbed } from 'discord.js';
import { ApplicationCommandTypes } from 'discord.js/typings/enums';
import { Command } from '../lib/Command';

export default new Command({
	name: 'ban',
	aliases: ['ban'],
	description: 'Bans an user',
	usage:
		'userid | mention not limited to one. You can supply a list of ids/mentions',
	type: ApplicationCommandTypes.MESSAGE,
	isArgumentsRequired: true,
	isClass: false,
	guildOnly: true,
	isAdminOnly: true,
	isSlash: false,
	// The ? Operator makes the compiler happy, also message and params will never be undefined because its gets checked before the command is executed.
	// But doing the types like that makes it easier
	run: async (options) => {
		options.params?.forEach(async (mention) => {
			if (
				mention.startsWith('<@') &&
				mention.endsWith('>') &&
				isNaN(parseInt(mention))
			) {
				mention = mention.slice(2, -1);

				if (mention.startsWith('!')) {
					mention = mention.slice(1);
					await ban(options.message as Message, mention);
				}
			} else if (!isNaN(parseInt(mention))) {
				await ban(options.message as Message, mention);
			}
		});
	},
});

async function ban(message: Message, id: string) {
	try {
		await message.guild?.bans.create(id);
	} catch (error) {
		message.reply('Not found');
	}
}
