import { Command } from '../lib/Command';

export default new Command({
	name: 'ping',
	description: 'replies with pong',
	run: async ({ interaction }) => {
		interaction.followUp(`Ping: ${interaction.client.ws.ping}ms`);
	},
});
