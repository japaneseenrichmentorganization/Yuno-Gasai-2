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
		const resArry = new Array<string>();
		const ids = Array<string>();
		options.params?.forEach(async (mention) => {
			if (
				mention.startsWith('<@') &&
				mention.endsWith('>') &&
				isNaN(parseInt(mention))
			) {
				mention = mention.slice(2, -1);

				if (mention.startsWith('!')) {
					ids.push(mention);
				}
			} else if (!isNaN(parseInt(mention))) {
				ids.push(mention);
			}
		});
		for await (const id of ids) {
			resArry.push(
				'<@!' +
					id +
					'> has been ' +
					(await ban(options.message as Message, id)),
			);
		}
		const embed = new MessageEmbed()
			.setColor('#43cc24')
			.setTitle(':white_check_mark: Ban successful.')
			.setDescription(
				`:arrow_right: User${resArry.length > 1 ? 's' : ''}: ${resArry.join(
					' ',
				)}`,
			);
		await options.message?.reply({
			embeds: [embed],
		});
		console.log(resArry);
	},
});

async function ban(message: Message, id: string): Promise<string> {
	console.log('Executed');
	try {
		await message.guild?.bans.create(id);
		console.log('successful');
		return 'successfully banned.\n';
	} catch (error) {
		console.log(error);
		return 'unsuccessfully banned.\n';
	}
}
