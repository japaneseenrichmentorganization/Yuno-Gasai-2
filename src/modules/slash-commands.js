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

const { SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require("discord.js");

let Yuno = null;
let discClient = null;
let ONE_TIME_EVENT = false;
let slashCommandsEnabled = true;

module.exports.modulename = "slash-commands";

// Define slash commands
const slashCommands = [
    new SlashCommandBuilder()
        .setName("delay")
        .setDescription("Delay the auto-clean for this channel"),

    new SlashCommandBuilder()
        .setName("clean")
        .setDescription("Clean a channel")
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("The channel to clean (defaults to current channel)")
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user from the server")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to ban")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the ban")
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user from the server")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to kick")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the kick")
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user from the server")
        .addStringOption(option =>
            option.setName("user")
                .setDescription("The user ID to unban")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the unban")
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to timeout")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("duration")
                .setDescription("Duration in minutes")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)) // Max 28 days
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the timeout")
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName("mod-stats")
        .setDescription("Show moderator statistics for this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName("scan-bans")
        .setDescription("Import moderation actions into the database")
        .addStringOption(option =>
            option.setName("mode")
                .setDescription("Scan mode")
                .setRequired(false)
                .addChoices(
                    { name: "Ban List (recommended for large servers)", value: "bans" },
                    { name: "Audit Log (includes moderator info, ~45 day history)", value: "audit" }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName("auto-clean")
        .setDescription("Manage auto-clean settings for channels")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Add auto-clean to a channel")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The channel to add auto-clean to")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("hours")
                        .setDescription("Hours between each clean")
                        .setRequired(true)
                        .setMinValue(1))
                .addIntegerOption(option =>
                    option.setName("warning")
                        .setDescription("Minutes before clean to show warning")
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Remove auto-clean from a channel")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("The channel to remove auto-clean from")
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("List all auto-cleans or info about a specific channel")
                .addChannelOption(option =>
                    option.setName("channel")
                        .setDescription("Specific channel to get info about")
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName("prefix")
        .setDescription("Set the bot prefix for this server")
        .addStringOption(option =>
            option.setName("prefix")
                .setDescription("The new prefix to use")
                .setRequired(true)
                .setMaxLength(10))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show available commands")
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Get help for a specific command")
                .setRequired(false)),
];

// Register slash commands with Discord
async function registerSlashCommands() {
    if (!slashCommandsEnabled) return;

    const rest = new REST({ version: '10' }).setToken(discClient.token);

    try {
        Yuno.prompt.info("Registering slash commands...");

        await rest.put(
            Routes.applicationCommands(discClient.user.id),
            { body: slashCommands.map(cmd => cmd.toJSON()) }
        );

        Yuno.prompt.success(`Successfully registered ${slashCommands.length} slash command(s).`);
    } catch (error) {
        Yuno.prompt.error("Error registering slash commands:", error);
    }
}

// Command handler map - maps command names to their execution logic
const COMMAND_HANDLERS = {
    delay: (interaction) => "delay",

    clean: (interaction) => {
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        return `clean <#${channel.id}>`;
    },

    ban: (interaction) => {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "";
        return `ban <@${user.id}> ${reason}`;
    },

    kick: (interaction) => {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "";
        return `kick <@${user.id}> ${reason}`;
    },

    unban: (interaction) => {
        const userId = interaction.options.getString("user");
        const reason = interaction.options.getString("reason") || "";
        return `unban ${userId} ${reason}`;
    },

    timeout: (interaction) => {
        const user = interaction.options.getUser("user");
        const duration = interaction.options.getInteger("duration");
        const reason = interaction.options.getString("reason") || "";
        return `timeout <@${user.id}> ${duration} ${reason}`;
    },

    "mod-stats": () => "mod-stats",

    "scan-bans": (interaction) => {
        const mode = interaction.options.getString("mode") || "bans";
        return `scan-bans ${mode}`;
    },

    "auto-clean": (interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel("channel");

        const subcommandHandlers = {
            add: () => {
                const hours = interaction.options.getInteger("hours");
                const warning = interaction.options.getInteger("warning");
                return `auto-clean add <#${channel.id}> ${hours} ${warning}`;
            },
            remove: () => `auto-clean remove <#${channel.id}>`,
            list: () => channel ? `auto-clean list <#${channel.id}>` : "auto-clean list"
        };

        return subcommandHandlers[subcommand]?.() ?? null;
    },

    prefix: (interaction) => {
        const prefix = interaction.options.getString("prefix");
        return `prefix ${prefix}`;
    },

    help: (interaction) => {
        const cmd = interaction.options.getString("command");
        return cmd ? `help ${cmd}` : "help";
    }
};

// Create fake message object for command compatibility
const createFakeMessage = (interaction) => {
    let hasReplied = false;

    const fakeMsg = {
        channel: interaction.channel,
        guild: interaction.guild,
        member: interaction.member,
        author: interaction.user,
        mentions: {
            channels: { first: () => interaction.options.getChannel("channel") },
            users: { first: () => interaction.options.getUser("user") }
        },
        content: "",
        reply: async (content) => interaction.reply(content),
        deletable: false
    };

    // Override channel.send to use interaction.reply/followUp
    fakeMsg.channel.send = async (content) => {
        if (!hasReplied) {
            hasReplied = true;
            return interaction.reply(content);
        }
        return interaction.followUp(content);
    };

    return { fakeMsg, hasReplied: () => hasReplied };
};

// Handle slash command interactions
async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const handler = COMMAND_HANDLERS[commandName];

    if (!handler) {
        return interaction.reply({ content: "Unknown command.", ephemeral: true });
    }

    const { fakeMsg, hasReplied } = createFakeMessage(interaction);

    try {
        const commandString = handler(interaction);
        if (commandString) {
            await Yuno.commandMan.execute(Yuno, interaction.member, commandString, fakeMsg);
        }
    } catch (error) {
        Yuno.prompt.error(`Error handling slash command ${commandName}:`, error);
        const errorMsg = { content: "An error occurred while executing this command.", ephemeral: true };
        hasReplied() ? await interaction.followUp(errorMsg) : await interaction.reply(errorMsg);
    }
}

async function discordConnected(yuno) {
    discClient = yuno.dC;
    Yuno = yuno;

    if (slashCommandsEnabled) {
        await registerSlashCommands();
    }

    if (!ONE_TIME_EVENT) {
        discClient.on("interactionCreate", handleInteraction);
    }

    ONE_TIME_EVENT = true;
}

module.exports.init = async function(yuno, hotReloaded) {
    if (hotReloaded) {
        await discordConnected(yuno);
    } else {
        yuno.on("discord-connected", discordConnected);
    }
}

module.exports.configLoaded = function(yuno, config) {
    const enabled = config.get("slash-commands.enabled");
    if (typeof enabled === "boolean") {
        slashCommandsEnabled = enabled;
    }
}

module.exports.beforeShutdown = function(yuno) {
    if (discClient) {
        discClient.removeListener("interactionCreate", handleInteraction);
    }
    ONE_TIME_EVENT = false;
}
