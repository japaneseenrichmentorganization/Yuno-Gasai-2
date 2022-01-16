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

import { EntityRepository } from '@mikro-orm/core';
import { TextChannel, MessageEmbed } from 'discord.js';
import { ApplicationCommandTypes } from 'discord.js/typings/enums';
import { Channelcleans } from '../entities/Channelcleans';
import { Command } from '../lib/Command';
import { ExtendedClient } from '../interfaces/Client';
import { CommandType, RunOptions } from '../interfaces/Command';

interface dataObj {
	ChannelRepository: EntityRepository<Channelcleans>;
	mentionedChannel: TextChannel | undefined;
	channel: TextChannel;
	dbChannel: Channelcleans | null;
}
class AutoClean extends Command {
	constructor(commandOptions: CommandType) {
		super(commandOptions);
	}
	//Add channel to cleaning list
	async add(options: RunOptions) {
		const { dbChannel, ChannelRepository, mentionedChannel, channel } =
			await getArgs(options);
		const timeBetweenCleaning = parseInt(options.params?.at(1) as string);
		const warningTime = parseInt(options.params?.at(2) as string);
		if (mentionedChannel == undefined)
			return await options.message?.channel.send('Please mention a channel');
		if (
			timeBetweenCleaning > 24 ||
			timeBetweenCleaning < 0 ||
			isNaN(timeBetweenCleaning)
		)
			return await channel.send(`${timeBetweenCleaning} is not a valid hour`);
		if (warningTime > 60 || warningTime < 0 || isNaN(warningTime))
			return await channel.send(`${warningTime} is not a valid minute`);
		if (dbChannel !== null)
			return await channel.send(
				':negative_squared_cross_mark: The channel you asked to add an auto-clean already has an auto-clean.\nPlease use `auto-clean edit`.',
			);
		ChannelRepository.persist(
			ChannelRepository.create({
				gid: channel.guildId,
				cname: (mentionedChannel as TextChannel).name,
				cleantime: timeBetweenCleaning.toString(),
				warningtime: warningTime.toString(),
				remainingtime: 0,
			}),
		);
		await ChannelRepository.flush().then(async () => {
			await (channel.client as ExtendedClient).registerCleaningJobs();
		});
		await channel.send(
			buildReturnMessageAddEdited(
				mentionedChannel.id,
				timeBetweenCleaning,
				warningTime,
			),
		);
		return;
	}
	async remove(options: RunOptions) {
		const { dbChannel, ChannelRepository, mentionedChannel, channel } =
			await getArgs(options);
		if (mentionedChannel == undefined)
			options.message?.channel.send('Please mention a channel');
		if (dbChannel == null)
			return channel.send(
				':negative_squared_cross_mark: This channel doesn\'t have any auto-clean set up',
			);
		ChannelRepository.removeAndFlush(dbChannel);
		options.client.channelsToClean.get(channel.name + '_warn')?.cancel();
		options.client.channelsToClean.get(channel.name + '_clean')?.cancel();
		return await channel.send(
			':white_check_mark: The auto-clean has been removed.',
		);
	}
	async delay(options: RunOptions) {
		await this.remove(options);
		await this.add(options);
	}
	async edit(options: RunOptions) {
		const { dbChannel, ChannelRepository, channel } = await getArgs(options);
		const newTimeBetweenCleaning = parseInt(options.params?.at(1) as string);
		const newWarningTime = parseInt(options.params?.at(2) as string);
		if (newTimeBetweenCleaning > 24 || newTimeBetweenCleaning < 0)
			return await channel.send(
				`${newTimeBetweenCleaning} is not a valid hour`,
			);
		if (newWarningTime > 60 || newWarningTime < 0)
			return await channel.send(`${newWarningTime} is not a valid minute`);
		if (dbChannel == null)
			return channel.send(
				':negative_squared_cross_mark: This channel doesn\'t have any auto-clean set up',
			);
		ChannelRepository.persistAndFlush(
			ChannelRepository.create({
				gid: dbChannel.gid,
				cname: dbChannel.cname,
				cleantime: newTimeBetweenCleaning.toString(),
				warningtime: newWarningTime.toString(),
				remainingtime: 0,
			}),
		);
		return await channel.send(
			buildReturnMessageAddEdited(
				channel.id,
				newTimeBetweenCleaning,
				newWarningTime,
			),
		);
	}
	async list(options: RunOptions) {
		const { dbChannel, ChannelRepository, channel } = await getArgs(options);
		if (options.params?.at(1) === undefined) {
			if (dbChannel == null)
				return channel.send(
					':negative_squared_cross_mark: This channel doesn\'t have any auto-clean set up',
				); // Can't be null would have been caught above before executing this function
			await channel.send({
				embeds: [
					new MessageEmbed()
						.setColor('#ff51ff')
						.setTitle('#' + channel.name + ' auto-clean configuration.')
						.addField(
							'Time between each clean',
							parseInt(dbChannel.cleantime) + 'h',
							true,
						)
						.addField(
							'Warning thrown at',
							parseInt(dbChannel.warningtime) + 'remaining',
							true,
						),
				],
			});
		} else {
			const chan = await ChannelRepository.findAll();
			return await channel.send({
				embeds: [
					new MessageEmbed()
						.setColor('#ff51ff')
						.setTitle('Channels having an auto-clean:')
						.setDescription(
							chan.length ? '``` ' + chan.join(', ') + ' ```' : 'None.',
						),
				],
			});
		}
	}
}

export default new AutoClean({
	name: 'auto-clean',
	description:
		'Adds an auto-clean for a channel.\nadd is to add a new auto-clean\nremove to delete an auto-clean\nedit to change the delays of an auto-clean\nreset to reset the counter of an a.-c.\nlist to lists all the actives auto-cleans',
	usage:
		'<add | remove | edit | reset | delay | list> [#channel | all] [time between cleans in hours | time in minutes to add (delay)] [time for the warning before the clean in minutes, number]',
	aliases: ['autoclean'],
	isArgumentsRequired: true,
	isAdminOnly: true,
	guildOnly: true,
	isClass: true,
	missingArgumentsResponse:
		':negative_squared_cross_mark: Not enough arguments.',
	type: ApplicationCommandTypes.MESSAGE,
	subCmdsName: ['add', 'remove', 'edit', 'list'],
	isSlash: false,
	run: async function (options) {
		// It cant be a DM as the bot doesn't in DM'S with this command
		return await options.message?.channel.send(this.usage ?? '');
	},
});
async function getArgs(options: RunOptions): Promise<dataObj> {
	const ChannelRepository = options.client.orm.em.getRepository(Channelcleans);
	const mentionedChannel = options.message?.mentions.channels.first();
	const channel = options.message?.channel as TextChannel;
	const dbChannel = await ChannelRepository.findOne({
		cname: (mentionedChannel as TextChannel).name,
		gid: channel.guild.id,
	});
	return {
		ChannelRepository: ChannelRepository,
		mentionedChannel: mentionedChannel as TextChannel,
		channel: channel,
		dbChannel: dbChannel,
	};
}

function buildReturnMessageAddEdited(
	chid: string,
	betweenCleans: number,
	beforeWarning: number,
): string {
	return (
		'<#' +
		chid +
		'> will be cleaned every ' +
		betweenCleans +
		' hours and a warning will be thrown ' +
		beforeWarning +
		' minutes before.'
	);
}
