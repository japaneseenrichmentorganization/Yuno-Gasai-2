const blessed = require('neo-blessed');

const HINT_TEXT = '  Tab:Focus  PgUp/Dn:Scroll  Alt+M:Members  Ctrl+Q:Quit  :shortcuts  Alt+H:Hide';

function createHintBar(screen) {
    let visible = true;

    const bar = blessed.box({
        parent: screen,
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        content: HINT_TEXT,
        style: {
            bg: 'black',
            fg: 'brightwhite'
        }
    });

    function toggle() {
        visible = !visible;
        if (visible) {
            bar.show();
        } else {
            bar.hide();
        }
        screen.emit('hint-bar-toggled', visible);
        screen.render();
    }

    function isVisible() { return visible; }

    return { bar, toggle, isVisible };
}

module.exports = { createHintBar, HINT_TEXT };
