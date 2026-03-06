const blessed = require('neo-blessed');

function createMembersPane(screen) {
    let visible = false;

    const list = blessed.list({
        parent: screen,
        top: 1,
        right: 0,
        width: 20,
        bottom: 1,
        border: { type: 'line' },
        tags: true,
        hidden: true,
        style: {
            border: { fg: 'magenta' },
            item: { fg: 'white' }
        },
        label: ' Members '
    });

    function toggle() {
        visible = !visible;
        if (visible) { list.show(); } else { list.hide(); }
        screen.emit('members-pane-toggled', visible);
        screen.render();
    }

    function refresh(channel) {
        if (!visible || !channel?.guild) return;
        const members = [...channel.guild.members.cache.values()]
            .sort((a, b) => {
                const an = (a.nickname || a.user.username).toLowerCase();
                const bn = (b.nickname || b.user.username).toLowerCase();
                return an.localeCompare(bn);
            })
            .map(m => m.nickname || m.user.username);
        list.setItems(members);
        list.setLabel(` Members (${members.length}) `);
        screen.render();
    }

    function isVisible() { return visible; }

    return { list, toggle, refresh, isVisible };
}

module.exports = { createMembersPane };
