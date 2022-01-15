import { MessageEmbed, TextChannel, User } from 'discord.js';
import { Job, scheduleJob, RecurrenceRule, JobCallback } from 'node-schedule';
import { ExtendedClient } from './interfaces/Client';

function getAvatarURL(user: User) {
	return typeof user.avatar === 'string'
		? 'https://cdn.discordapp.com/avatars/' +
				user.id +
				'/' +
				user.avatar +
				'.png'
		: 'https://cdn.discordapp.com/embed/avatars/' +
				(parseInt(user.discriminator) % 5) +
				'.png';
}
async function clean(channel: TextChannel) {
	const nsfw = channel.nsfw,
		pos = channel.position;

	const n = await channel.clone({
		nsfw: nsfw,
		reason: 'Cleaning by Yuno.',
	});

	await channel.delete();
	await n.setPosition(pos);
	const embed = new MessageEmbed()
		.setImage(
			'https://vignette3.wikia.nocookie.net/futurediary/images/9/94/Mirai_Nikki_-_06_-_Large_05.jpg',
		)
		.setColor('#ff51ff');
	embed.author = {
		name: 'Yuno is done cleaning.',
		iconURL: n.client.user?.avatarURL() ?? '',
	};
	await n.send({ embeds: [embed] });
}
async function warnChannel(
	channel: TextChannel,
	client: ExtendedClient,
	minutes: number,
) {
	const embed = new MessageEmbed()
		.setImage(
			'https://vignette3.wikia.nocookie.net/futurediary/images/9/94/Mirai_Nikki_-_06_-_Large_05.jpg',
		)
		.setColor('#ff51ff');
	embed.author = {
		name:
			'Yuno is going to clean this channel in ' +
			minutes +
			' minutes. Speak now or forever hold your peace.',
	};
	channel.send({ embeds: [embed] });
}
function formatDuration(seconds: number) {
	const h = Math.floor(seconds / 3600),
		min = Math.floor((seconds - h * 3600) / 60),
		sec = seconds - h * 3600 - min * 60;
	let r = '';

	if (h > 0) r += ('00' + h).slice(-2) + 'h ';

	if (min > 0) r += ('00' + min).slice(-2) + 'min ';

	if (sec > 0) r += ('00' + sec).slice(-2) + 's';

	return r;
}
function checkIfUrl(url: string) {
	return /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-/]))?/.test(
		url,
	);
}
function cleanSynopsis(str: string, id: string, type: string) {
	if (str.length > 2048) {
		const tmpstr = str.slice(0, 1950).split('.');
		tmpstr.pop();
		str = `${tmpstr.join(
			'.',
		)}.\n\n[[ Read More ]](https://myanimelist.net/${type}/${id})\n\n`;
	}
	return str
		.replace(/\n\n/g, '\n')
		.replace(/\[.*\]/g, '')
		.replace(/\(Source: .*\)/g, '');
}
async function getChannelByName(
	client: ExtendedClient,
	name: string,
): Promise<TextChannel | undefined> {
	const chan = (
		await client.guilds.cache.get(client.guildID)?.channels.fetch()
	)?.filter((chan) => chan.name == name);
	return (chan?.first() as TextChannel) ?? undefined;
}
function produceWarnJob(
	hour: number,
	minute: number,
	name: string,
	callback: JobCallback,
): Job {
	const rule: RecurrenceRule = new RecurrenceRule();
	rule.second = minute;
	return scheduleJob(name + '_warn', rule, callback);
}
function produceCleanJob(
	hour: number,
	name: string,
	callback: JobCallback,
): Job {
	const rule: RecurrenceRule = new RecurrenceRule();
	rule.second = hour;
	return scheduleJob(name + '_clean', rule, callback);
}
export default {
	getAvatarURL,
	clean,
	warnChannel,
	formatDuration,
	checkIfUrl,
	produceWarnJob,
	cleanSynopsis,
	produceCleanJob,
	getChannelByName,
};
