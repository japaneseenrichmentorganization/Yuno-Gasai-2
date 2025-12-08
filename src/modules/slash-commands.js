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

// Handle slash command interactions
async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Create a fake message object for compatibility with existing commands
    const fakeMsg = {
        channel: interaction.channel,
        guild: interaction.guild,
        member: interaction.member,
        author: interaction.user,
        mentions: {
            channels: {
                first: () => interaction.options.getChannel("channel")
            },
            users: {
                first: () => interaction.options.getUser("user")
            }
        },
        content: "",
        reply: async (content) => interaction.reply(content),
        deletable: false
    };

    // Override channel.send to use interaction.reply
    let hasReplied = false;
    const originalSend = fakeMsg.channel.send.bind(fakeMsg.channel);
    fakeMsg.channel.send = async (content) => {
        if (!hasReplied) {
            hasReplied = true;
            return interaction.reply(content);
        } else {
            return interaction.followUp(content);
        }
    };

    try {
        switch (commandName) {
            case "delay":
                await Yuno.commandMan.execute(Yuno, interaction.member, "delay", fakeMsg);
                break;

            case "clean": {
                const channel = interaction.options.getChannel("channel") || interaction.channel;
                await Yuno.commandMan.execute(Yuno, interaction.member, `clean <#${channel.id}>`, fakeMsg);
                break;
            }

            case "ban": {
                const user = interaction.options.getUser("user");
                const reason = interaction.options.getString("reason") || "";
                await Yuno.commandMan.execute(Yuno, interaction.member, `ban <@${user.id}> ${reason}`, fakeMsg);
                break;
            }

            case "kick": {
                const user = interaction.options.getUser("user");
                const reason = interaction.options.getString("reason") || "";
                await Yuno.commandMan.execute(Yuno, interaction.member, `kick <@${user.id}> ${reason}`, fakeMsg);
                break;
            }

            case "unban": {
                const userId = interaction.options.getString("user");
                const reason = interaction.options.getString("reason") || "";
                await Yuno.commandMan.execute(Yuno, interaction.member, `unban ${userId} ${reason}`, fakeMsg);
                break;
            }

            case "timeout": {
                const user = interaction.options.getUser("user");
                const duration = interaction.options.getInteger("duration");
                const reason = interaction.options.getString("reason") || "";
                await Yuno.commandMan.execute(Yuno, interaction.member, `timeout <@${user.id}> ${duration} ${reason}`, fakeMsg);
                break;
            }

            case "mod-stats":
                await Yuno.commandMan.execute(Yuno, interaction.member, "mod-stats", fakeMsg);
                break;

            case "scan-bans": {
                const mode = interaction.options.getString("mode") || "bans";
                await Yuno.commandMan.execute(Yuno, interaction.member, `scan-bans ${mode}`, fakeMsg);
                break;
            }

            case "auto-clean": {
                const subcommand = interaction.options.getSubcommand();
                const channel = interaction.options.getChannel("channel");

                switch (subcommand) {
                    case "add": {
                        const hours = interaction.options.getInteger("hours");
                        const warning = interaction.options.getInteger("warning");
                        await Yuno.commandMan.execute(Yuno, interaction.member, `auto-clean add <#${channel.id}> ${hours} ${warning}`, fakeMsg);
                        break;
                    }
                    case "remove":
                        await Yuno.commandMan.execute(Yuno, interaction.member, `auto-clean remove <#${channel.id}>`, fakeMsg);
                        break;
                    case "list":
                        if (channel) {
                            await Yuno.commandMan.execute(Yuno, interaction.member, `auto-clean list <#${channel.id}>`, fakeMsg);
                        } else {
                            await Yuno.commandMan.execute(Yuno, interaction.member, "auto-clean list", fakeMsg);
                        }
                        break;
                }
                break;
            }

            case "prefix": {
                const prefix = interaction.options.getString("prefix");
                await Yuno.commandMan.execute(Yuno, interaction.member, `prefix ${prefix}`, fakeMsg);
                break;
            }

            case "help": {
                const cmd = interaction.options.getString("command");
                if (cmd) {
                    await Yuno.commandMan.execute(Yuno, interaction.member, `help ${cmd}`, fakeMsg);
                } else {
                    await Yuno.commandMan.execute(Yuno, interaction.member, "help", fakeMsg);
                }
                break;
            }

            default:
                if (!hasReplied) {
                    await interaction.reply({ content: "Unknown command.", ephemeral: true });
                }
        }
    } catch (error) {
        Yuno.prompt.error(`Error handling slash command ${commandName}:`, error);
        if (!hasReplied) {
            await interaction.reply({ content: "An error occurred while executing this command.", ephemeral: true });
        } else {
            await interaction.followUp({ content: "An error occurred while executing this command.", ephemeral: true });
        }
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

module.exports.init = function(yuno, hotReloaded) {
    if (hotReloaded) {
        discordConnected(yuno);
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
