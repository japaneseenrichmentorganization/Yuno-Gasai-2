const blessed = require('neo-blessed');

function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function formatEmbed(embed) {
    const title = embed.title || '(no title)';
    const desc  = embed.description ? ` — ${embed.description.slice(0, 80)}` : '';
    return `[Embed: ${title}${desc}]`;
}

function formatMessage(msg) {
    const time = formatTime(msg.createdAt);
    const user = msg.author?.username || '?';
    let body = msg.content || '';
    if (!body && msg.embeds?.length) {
        body = msg.embeds.map(formatEmbed).join(' ');
    }
    if (!body) body = '*[no text content]*';
    return `[${time}] ${user}: ${body}`;
}

function createChatPane(screen, hintBarVisible) {
    const box = blessed.log({
        parent: screen,
        top: 1,
        left: 22,
        right: 0,
        bottom: 4,
        border: { type: 'line' },
        tags: false,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        style: { border: { fg: 'cyan' } },
        label: ' Chat '
    });

    let _activeChannelId = null;

    async function setChannel(channel, cache) {
        _activeChannelId = channel.id;
        box.setLabel(` #${channel.name} — ${channel.guild?.name || 'DM'} `);
        box.setContent('');

        let messages;
        if (cache.has(channel.id)) {
            messages = cache.get(channel.id);
        } else {
            try {
                const fetched = await channel.messages.fetch({ limit: 50 });
                messages = [...fetched.values()].reverse();
                cache.set(channel.id, messages);
            } catch (e) {
                box.pushLine(`[Could not fetch history: ${e.message}]`);
                screen.render();
                return;
            }
        }

        for (const msg of messages) {
            box.pushLine(formatMessage(msg));
        }
        screen.render();
    }

    function appendMessage(msg, activeChannelId) {
        if (msg.channelId !== activeChannelId) return;
        box.pushLine(formatMessage(msg));
        screen.render();
    }

    box._setChannel = setChannel;
    box._appendMessage = appendMessage;
    box._getActiveChannelId = () => _activeChannelId;

    return { box, setChannel, appendMessage };
}

module.exports = { createChatPane, formatMessage, formatEmbed };
