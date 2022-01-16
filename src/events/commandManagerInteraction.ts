/*
    Yuno Gasai. A Discord.JS based bot, with multiple features.
    Copyright (C) 2018 Maeeen <maeeennn@gmail.com>  

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see https://www.gnu.org/licenses/.
*/
import { CommandInteractionOptionResolver } from 'discord.js';
import { Event } from '../lib/Event';
import { CommandType, ExtendedInteraction } from '../interfaces/Command';
import { ExtendedClient } from '../interfaces/Client';

// Slashcommands handling
export default new Event('interactionCreate', async (interaction) => {
	// checks if the bot has booted(initialized)
	if (!(interaction.client as ExtendedClient).booted) return;
	// Chat Input Commands TYPE: CHAT_INPUT
	if (interaction.isCommand()) {
		await interaction.deferReply();
		const command = (interaction.client as ExtendedClient).slashCommands.find(
			(cmd) => {
				return cmd.name == interaction.command?.name;
			},
		) as CommandType;
		if (!command)
			return interaction.followUp('You have used a non existent command');
		await command.run({
			interactionOptions:
				interaction.options as CommandInteractionOptionResolver,
			client: interaction.client as ExtendedClient,
			interaction: interaction as ExtendedInteraction,
		});
	}
});
