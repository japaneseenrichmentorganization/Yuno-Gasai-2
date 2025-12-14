module.exports.messageProcName = "mention-responses"

const {EmbedBuilder} = require("discord.js");

let mentionResponses = [];

module.exports.message = async function(content, msg) {
    for (const mentionResponse of mentionResponses) {
        if (msg.guild.id === mentionResponse.guildId && msg.content.toLowerCase().replace(msg.client.user.toString(), '').trim().includes(mentionResponse.trigger.trim()) && msg.mentions.members.has(msg.client.user.id)) {
            const embed = new EmbedBuilder()
                .setDescription(mentionResponse.response.replaceAll("${author}", msg.author.username))
                .setColor("#ff51ff");

            if (mentionResponse.image !== "null")
                embed.setImage(mentionResponse.image);

            await msg.channel.send({embeds: [embed]});
            break;
        }
    }
}

module.exports.discordConnected = async function(Yuno) {
    mentionResponses = await Yuno.dbCommands.getMentionResponses(Yuno.database)
}

module.exports.configLoaded = async function(Yuno) {
}