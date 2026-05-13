#!/bin/sh

# Yuno Gasai 2 - Production Startup Script
# Requires Node.js 24.0.0 or higher

# Enable Node.js 24 experimental features
export NODE_ENV=production

# Resolve the bot's directory from the script's location so that the
# Node.js Permission Model paths are correct regardless of where start.sh
# is called from (e.g. a tmux session launched from a different cwd).
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Node.js 24 native SQLite support
NODE_OPTIONS="--experimental-sqlite"

# === PERMISSION MODEL ===
# Restricts the process to its own directory only.
# --allow-fs-read=$BOT_DIR   : read config, db, node_modules, src
# --allow-fs-write=$BOT_DIR  : write database, BANS-*.txt, logs
# --allow-child-process      : db-integrity-check.js, git (auto-update)
# --allow-addons             : bufferutil, utf-8-validate, zlib-sync (Discord.js native addons)
#
# NOTE: If your database path in config.json is an absolute path outside the
# bot directory, add an extra --allow-fs-read=/path/to/db --allow-fs-write=/path/to/db
NODE_OPTIONS="$NODE_OPTIONS --permission --allow-fs-read=$BOT_DIR --allow-fs-write=$BOT_DIR --allow-child-process --allow-addons"

# === MEMORY CONFIGURATION ===
# Detect if running on a low-memory system (Pi, embedded, <4GB RAM)
# Uncomment the appropriate line for your system:

# For Raspberry Pi 4 (8GB) - recommended settings:
NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=2048"

# For Raspberry Pi 4 (4GB):
# NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=1024"

# For Raspberry Pi 3/Zero or systems with <2GB:
# NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=512"

# For large servers (16GB+ RAM):
# NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=4096"

# === GARBAGE COLLECTION ===
# More aggressive GC for low-memory systems (reduces memory spikes)
# Uncomment for Pi/embedded systems:
GC_OPTIONS="--gc-interval=100"

# === ARM/FreeBSD FIX ===
# Disable Turbofan JIT optimizer - it generates illegal instructions on ARM FreeBSD
# This prevents SIGILL crashes (signal 4)
ARCH=$(uname -m)
case "$ARCH" in
    aarch64|arm64|armv*)
        ARM_FIX="--no-turbofan"
        echo "Detected ARM architecture ($ARCH) - disabling Turbofan JIT"
        ;;
    *)
        ARM_FIX=""
        ;;
esac

# === NOTES ===
# If running on Pi with presence logging enabled, also set in config.json:
#   "activityLogger.lowMemoryMode": true
# This enables buffer limits and automatic cleanup of stale data.

export NODE_OPTIONS
exec node $GC_OPTIONS $ARM_FIX index.js "$@"
