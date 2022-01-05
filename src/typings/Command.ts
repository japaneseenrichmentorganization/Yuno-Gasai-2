import {
	ChatInputApplicationCommandData,
	CommandInteraction,
	CommandInteractionOptionResolver,
	GuildMember,
	PermissionResolvable,
} from 'discord.js';
import { ApplicationCommandTypes } from 'discord.js/typings/enums';
import { ExtendedClient } from './Client';

/**
 * {
 *  name: "commandname",
 * description: "any description",
 * run: async({ interaction }) => {
 *
 * }
 * }
 */


 type DiscordPermissionString =
 | 'CREATE_INSTANT_INVITE'
 | 'KICK_MEMBERS'
 | 'BAN_MEMBERS'
 | 'ADMINISTRATOR'
 | 'MANAGE_CHANNELS'
 | 'MANAGE_GUILD'
 | 'ADD_REACTIONS'
 | 'VIEW_AUDIT_LOG'
 | 'PRIORITY_SPEAKER'
 | 'STREAM'
 | 'VIEW_CHANNEL'
 | 'SEND_MESSAGES'
 | 'SEND_TTS_MESSAGES'
 | 'MANAGE_MESSAGES'
 | 'EMBED_LINKS'
 | 'ATTACH_FILES'
 | 'READ_MESSAGE_HISTORY'
 | 'MENTION_EVERYONE'
 | 'USE_EXTERNAL_EMOJIS'
 | 'VIEW_GUILD_INSIGHTS'
 | 'CONNECT'
 | 'SPEAK'
 | 'MUTE_MEMBERS'
 | 'DEAFEN_MEMBERS'
 | 'MOVE_MEMBERS'
 | 'USE_VAD'
 | 'CHANGE_NICKNAME'
 | 'MANAGE_NICKNAMES'
 | 'MANAGE_ROLES'
 | 'MANAGE_WEBHOOKS'
 | 'MANAGE_EMOJIS';
export interface ExtendedInteraction extends CommandInteraction {
	member: GuildMember;
}

interface RunOptions {
	client: ExtendedClient;
	interaction: ExtendedInteraction;
	args: CommandInteractionOptionResolver;
}

type RunFunction = (options: RunOptions) => void | Promise<void>;

export type CommandType = {
	name: string;
  description: string;
	type: ApplicationCommandTypes
	required?: boolean;
	userPermissions?: PermissionResolvable[];
  cooldown?: number;
  guildOnly?: boolean;
  aliases?: string[];
  usage?: string;
  isArgumentsRequired?: boolean;
  requiredPermissions?: DiscordPermissionString[];
  requiredRoles?: string[];
	run: RunFunction;
}