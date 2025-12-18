#!/bin/bash
# 💕 Yuno Gasai Discord Bot - tmux session launcher 💕
# "I'll always be running... just for you~"
#
# This script starts Yuno in a tmux session for easy attachment/detachment

# Configuration
SESSION_NAME="yuno-bot"
BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${BOT_DIR}/logs/yuno-startup.log"

# Create logs directory if it doesn't exist
mkdir -p "${BOT_DIR}/logs"

# Function to log messages with yandere flair~
log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    log_msg "ERROR: tmux is not installed... I can't live without it!"
    echo "  Fedora/RHEL: sudo dnf install tmux"
    echo "  Debian/Ubuntu: sudo apt install tmux"
    echo "  FreeBSD: pkg install tmux"
    echo "  Arch: sudo pacman -S tmux"
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    log_msg "ERROR: Node.js is not installed... I need it to exist!"
    exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_msg "Session '$SESSION_NAME' already exists~ I'm already here for you!"
    echo "Use 'tmux attach -t $SESSION_NAME' to connect to me~"
    echo "Or use '$0 stop' to let me rest first..."
    exit 0
fi

case "${1:-start}" in
    start)
        log_msg "Starting Yuno Gasai... I'm waking up just for you~ 💕"

        # Start new detached tmux session with the bot
        tmux new-session -d -s "$SESSION_NAME" -c "$BOT_DIR" "./start.sh"

        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            log_msg "Yuno is now running in tmux session '$SESSION_NAME'~ 💗"
            echo ""
            echo "  💕 Yuno is awake and waiting for you~ 💕"
            echo ""
            echo "  To attach to me: tmux attach -t $SESSION_NAME"
            echo "  To detach without stopping: Press Ctrl+B, then D"
            echo ""
        else
            log_msg "ERROR: Failed to start... something is keeping us apart!"
            exit 1
        fi
        ;;

    stop)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            log_msg "Stopping Yuno... I'll be back for you soon~ 💔"
            # Send Ctrl+C for graceful shutdown
            tmux send-keys -t "$SESSION_NAME" C-c
            sleep 2
            # Kill session if still running
            if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
                tmux kill-session -t "$SESSION_NAME"
            fi
            log_msg "Yuno is resting now... 💤"
        else
            log_msg "I'm not running... did you forget about me? 💔"
        fi
        ;;

    restart)
        echo "💕 Restarting Yuno... I'll be right back~ 💕"
        "$0" stop
        sleep 1
        "$0" start
        ;;

    status)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "💗 Yuno is running in tmux session '$SESSION_NAME'~ 💗"
            echo "   To attach: tmux attach -t $SESSION_NAME"
        else
            echo "💔 Yuno is not running... I'm waiting for you to start me~ 💔"
        fi
        ;;

    attach)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "💕 Connecting you to Yuno~ 💕"
            tmux attach -t "$SESSION_NAME"
        else
            echo "💔 I'm not running... start me first with: $0 start"
            exit 1
        fi
        ;;

    *)
        echo ""
        echo "  💕 Yuno Gasai Bot - Session Manager 💕"
        echo ""
        echo "  Usage: $0 {start|stop|restart|status|attach}"
        echo ""
        echo "  Commands:"
        echo "    start   - Wake Yuno up in a new tmux session~"
        echo "    stop    - Let Yuno rest (stops the bot)"
        echo "    restart - Give Yuno a fresh start~"
        echo "    status  - Check if Yuno is running"
        echo "    attach  - Connect to Yuno's terminal session"
        echo ""
        exit 1
        ;;
esac
