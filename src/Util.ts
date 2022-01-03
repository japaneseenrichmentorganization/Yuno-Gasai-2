import { TextChannel, User } from 'discord.js';

export function getAvatarURL(user: User) {
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
export async function clean(channel: TextChannel) {
	const nsfw = channel.nsfw,
		pos = channel.position;

	const n = await channel.clone({
		nsfw: nsfw,
		reason: 'Cleaning by Yuno.',
	});

	await channel.delete();
	await n.setPosition(pos);

	return n;
}
export function formatDuration(seconds: number) {
	const h = Math.floor(seconds / 3600),
		min = Math.floor((seconds - h * 3600) / 60),
		sec = seconds - h * 3600 - min * 60;
	let r = '';

	if (h > 0) r += ('00' + h).slice(-2) + 'h ';

	if (min > 0) r += ('00' + min).slice(-2) + 'min ';

	if (sec > 0) r += ('00' + sec).slice(-2) + 's';

	return r;
}
export function checkIfUrl(url: string) {
	return /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-/]))?/.test(
		url
	);
}
export function cleanSynopsis(str: string, id: string, type: string) {
	if (str.length > 2048) {
		const tmpstr = str.slice(0, 1950).split('.');
		tmpstr.pop();
		str = `${tmpstr.join(
			'.'
		)}.\n\n[[ Read More ]](https://myanimelist.net/${type}/${id})\n\n`;
	}
	return str
		.replace(/\n\n/g, '\n')
		.replace(/\[.*\]/g, '')
		.replace(/\(Source: .*\)/g, '');
}
