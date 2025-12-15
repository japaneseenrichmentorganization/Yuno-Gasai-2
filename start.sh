#!/bin/bash

# Yuno Gasai 2 - Production Startup Script
# Requires Node.js 24.0.0 or higher

# Enable Node.js 24 experimental features
export NODE_ENV=production

# Node.js 24 native SQLite support
NODE_OPTIONS="--experimental-sqlite"

# Optional: Enable JIT for better performance (if V8 supports it)
# NODE_OPTIONS="$NODE_OPTIONS --jitless" # Disable if causing issues

# Optional: Increase memory limit for large servers
# NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=4096"

exec node $NODE_OPTIONS index.js "$@"
