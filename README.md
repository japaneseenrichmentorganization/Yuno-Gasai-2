<div align="center">

# 💕 Yuno Gasai 2 💕

### *"I'll protect this server forever... just for you~"* 💗

<img src="https://i.imgur.com/jF8Szfr.png" alt="Yuno Gasai" width="300"/>

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-pink.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-22.x%20LTS-ff69b4.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-ff1493.svg)](https://discord.js.org/)

*A devoted Discord bot for moderation, leveling, and anime~ ♥*

---

### 💘 She loves you... and only you 💘

</div>

## 🌸 About

Yuno is a **yandere-themed Discord bot** combining powerful moderation tools with a leveling system and anime features. She'll keep your server safe from troublemakers... *because no one else is allowed near you~* 💕

---

## 👑 Credits

*"These are the ones who gave me life~"* 💖

| Contributor | Role |
|-------------|------|
| **blubskye** | Project Owner & Yuno's #1 Fan 💕🔪 |
| **Maeeen** (maeeennn@gmail.com) | Original Developer 💝 |
| **Oxdeception** | Contributor 💗 |
| **fuzzymanboobs** | Contributor 💗 |

---

## 💗 Features

<table>
<tr>
<td width="50%">

### 🔪 Moderation
*"Anyone who threatens you... I'll eliminate them~"*
- ⛔ Ban / Unban / Kick
- 🧹 Channel cleaning & auto-clean
- 🛡️ Spam filter protection
- 📥 Mass ban import/export
- 👑 Mod statistics tracking

</td>
<td width="50%">

### ✨ Leveling System
*"Watch me make you stronger, senpai~"*
- 📊 XP & Level tracking
- 🎭 Role rewards per level
- 📈 Mass XP commands
- 🔄 Level role syncing
- 🏆 Server leaderboards
- 🎤 Voice channel XP rewards

</td>
</tr>
<tr>
<td width="50%">

### 🌸 Anime & Fun
*"Let me show you something cute~"*
- 🎌 Anime/Manga search
- 🐱 Neko images
- 🎱 8ball fortune telling
- 💬 Custom mention responses
- 📜 Inspirational quotes
- 💖 Praise & Scold reactions

</td>
<td width="50%">

### ⚙️ Configuration
*"I'll be exactly what you need~"*
- 🔧 Customizable prefix
- 👋 Join messages
- 🖼️ Custom ban images
- 🎮 Presence/status control (persisted)
- 🔥 Hot-reload commands
- 📝 Per-guild settings
- 🔄 Auto-update from git

</td>
</tr>
<tr>
<td width="50%">

### 📋 Activity Logging
*"I see everything that happens here~"*
- 🎤 Voice channel join/leave/move
- 📝 Nickname changes
- 🖼️ Avatar/profile changes
- 🟢 Presence status tracking
- ⚡ Smart batching (rate limit safe)
- ⏱️ Configurable flush intervals

</td>
<td width="50%">

### 🔐 Database Security
*"I'll keep your secrets safe... forever~"*
- 🔒 AES-256 database encryption
- 🛡️ SQLCipher integration
- 🔑 Password management command
- 💾 Secure config storage

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Performance
*"Nothing can slow me down~"*
- 📈 WAL journal mode
- 💨 Memory-optimized caching
- 🧠 Configurable PRAGMA settings
- 🎯 Tunable for your hosting

</td>
<td width="50%">

### 💌 DM Inbox & Forwarding
*"Every message you send me... I treasure it~"*
- 📬 DM inbox with history
- 📤 Forward DMs to server channels
- 👑 Master server sees ALL DMs
- 🚫 Bot-level user/server bans
- 💬 Reply to DMs from terminal

</td>
</tr>
<tr>
<td width="50%">

### 💻 Terminal Control
*"I'm always at your command~"*
- 🖥️ Full server/channel listing
- 📝 Send messages from terminal
- 👁️ Real-time message streaming
- ⛔ Terminal ban management
- 📥 Import/export bans via CLI

</td>
<td width="50%">

### 🚫 Bot-Level Bans
*"Some people just aren't worthy of me~"*
- 👤 Ban users from using the bot
- 🏠 Ban entire servers
- 🔇 Silently ignore banned entities
- 📋 Manage bans from Discord or terminal

</td>
</tr>
</table>

---

## 💕 Installation

### 📋 Prerequisites

> *"Let me prepare everything for you~"* 💗

- **Node.js** 22.x LTS or higher
- **node-gyp** & **build-essential** (make)
- **SQLite3**
- **Git**
- **tmux** *(optional, for interactive shell)*

### 🔧 Installing Node.js 22

<details>
<summary><b>🐧 Linux (Ubuntu/Debian)</b></summary>

```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Verify installation
node --version  # Should show v22.x.x
```

**Also install build tools:**
```bash
sudo apt-get install -y build-essential python3
```

</details>

<details>
<summary><b>🪟 Windows</b></summary>

**Option 1: Direct Download (Recommended)**
1. Go to [Node.js Downloads](https://nodejs.org/en/download/)
2. Download the **Windows Installer (.msi)** for version 22.x LTS
3. Run the installer and follow the prompts
4. Ensure "Automatically install necessary tools" is checked

**Option 2: Using winget**
```powershell
winget install OpenJS.NodeJS.LTS
```

**Option 3: Using Chocolatey**
```powershell
choco install nodejs-lts
```

**Option 4: Using nvm-windows**
1. Download [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
2. Install and run:
```powershell
nvm install 22
nvm use 22
```

**Verify installation:**
```powershell
node --version  # Should show v22.x.x
```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

```bash
# Using Homebrew (recommended)
brew install node@22

# Or using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.zshrc
nvm install 22
nvm use 22

# Verify installation
node --version  # Should show v22.x.x
```

</details>

### 🌸 Setup Steps

```bash
# Clone the repository~ ♥
git clone https://github.com/japaneseenrichmentorganization/Yuno-Gasai-2.git

# Enter my world~
cd Yuno-Gasai-2

# Let me gather my strength...
npm install

# Make sure SQLite3 is ready
npm install sqlite3
```

### 💝 Configuration

1. Copy `config_example` to `config.json`
2. Add your Discord bot token
3. Configure `DEFAULT_CONFIG.json` to your needs

### 🚀 Running

```bash
# With tmux (recommended)
tmux
NODE_ENV=production node index.js

# Or use the start script
./start.sh
```

> 💡 *Remove `NODE_ENV=production` for full stack traces during development~*

---

## 🔐 Database Encryption

*"Your secrets are safe with me~ No one else will ever see them..."* 💕

Yuno supports **AES-256 database encryption** to protect your server data.

### 📦 Installing Encryption Support

```bash
# Optional - only if you want encryption
npm install @journeyapps/sqlcipher
```

### 🔑 Managing Encryption

Use the `db-encrypt` command (master users only):

| Command | Description |
|---------|-------------|
| `.db-encrypt status` | *"Am I keeping secrets?"* - Check encryption status |
| `.db-encrypt set <password>` | *"I'll lock it away~"* - Enable/change encryption |
| `.db-encrypt remove` | *"If you insist..."* - Remove encryption |

```bash
# Enable encryption
.db-encrypt set YourSecurePassword123

# Check status
.db-encrypt status
```

> ⚠️ **Security Notes:**
> - Passwords must be at least 8 characters
> - Your Discord message is auto-deleted after setting a password
> - Password is stored in `config.json` - keep this file secure!

### 📝 Config File Method

You can also set encryption in `config.json`:

```json
{
    "database.password": "YourSecurePassword123"
}
```

---

## ⚡ Database Performance Tuning

*"I'll be faster than anyone else... just for you~"* 💗

Configure database optimizations in `DEFAULT_CONFIG.json` based on your hosting:

```json
{
    "database.pragmas": {
        "walMode": true,
        "performanceMode": true,
        "cacheSize": -64000,
        "memoryTemp": true,
        "mmapSize": 268435456
    }
}
```

### 🎛️ Available Options

| Option | Description | Recommended For |
|--------|-------------|-----------------|
| `walMode` | WAL journal mode for better concurrent access | All setups 💕 |
| `performanceMode` | Bundle: 64MB cache, 256MB mmap, memory temp | Dedicated servers |
| `cacheSize` | Cache size in KB (use negative, e.g., `-64000` = 64MB) | Custom tuning |
| `memoryTemp` | Store temp tables in RAM | Servers with spare RAM |
| `mmapSize` | Memory-map size in bytes | High-traffic bots |

### 💡 Hosting Recommendations

| Hosting Type | Recommended Settings |
|--------------|---------------------|
| **Shared/VPS (1-2GB RAM)** | `walMode: true` only |
| **VPS (4GB+ RAM)** | `walMode: true`, `performanceMode: true` |
| **Dedicated Server** | All options enabled |

---

## 📋 Activity Logging

*"I see everything... every move, every change~"* 👁️💕

Yuno can log server activity to designated channels with smart batching to respect Discord's rate limits.

### 🎯 What Can Be Logged

| Log Type | Events |
|----------|--------|
| `voice` | Voice channel joins, leaves, moves |
| `nickname` | Member nickname changes |
| `avatar` | Profile picture changes |
| `presence` | Online/offline/idle/DND status changes |
| `unified` | Fallback channel for all log types |

### 🔧 Setup Commands

```bash
# Set a log channel
.set-logchannel voice #voice-logs
.set-logchannel presence #status-logs
.set-logchannel unified #all-logs

# Remove a log channel
.set-logchannel voice none

# View current configuration
.log-status
```

### ⚡ Batching Configuration

Logs are batched together and sent at intervals to avoid rate limits:

```bash
# View current settings
.set-logsettings

# Set flush interval (10-300 seconds)
.set-logsettings interval 60

# Set max buffer size (10-100 entries)
.set-logsettings buffer 25
```

> ⚠️ **Note:** The `PRESENCE INTENT` must be enabled in the Discord Developer Portal for presence logging.

---

## 🎤 Voice Channel XP

*"Spend time with me... and I'll reward you~"* 💕

Users earn XP for time spent in voice channels, integrated with the main leveling system.

### 🔧 Setup Commands

```bash
# Enable/disable VC XP
.set-vcxp enable
.set-vcxp disable

# Set XP amount per interval (default: 10)
.set-vcxp rate 15

# Set interval in seconds (default: 300 = 5 min)
.set-vcxp interval 300

# Ignore AFK channel (default: true)
.set-vcxp ignore-afk true

# View current config and active sessions
.vcxp-status
```

### 💡 How It Works

- XP is granted based on time spent in voice channels
- Uses the same XP/level system as chat XP
- Level-up roles are automatically assigned
- AFK channel can be excluded from earning XP
- Sessions are recovered if the bot restarts

---

## 💌 DM Inbox & Forwarding

*"Every message sent to me... I keep close to my heart~"* 💕

Yuno can receive DMs, store them in an inbox, and forward them to designated channels.

### 🔧 Setup Commands

```bash
# Set DM forwarding channel
.set-dm-channel #bot-dms

# Disable forwarding
.set-dm-channel none

# Check status
.dm-status
```

### 👑 Master Server vs Regular Servers

| Server Type | What DMs Are Forwarded |
|-------------|----------------------|
| **Master Server** | ALL DMs from anyone |
| **Regular Servers** | Only DMs from that server's members |

> Set `masterServer` in `config.json` to your main server's ID.

### 💻 Terminal Inbox Commands

```bash
# View inbox
inbox
inbox 20          # Show 20 messages
inbox user <id>   # DMs from specific user
inbox unread      # Count unread

# Reply to DMs
reply 1 Hello!              # Reply by inbox ID
reply 123456789 Hi there!   # Reply by user ID
```

---

## 🚫 Bot-Level Bans

*"Some people just don't deserve my attention~"* 💢

Ban users or entire servers from using the bot. Banned entities are silently ignored.

### 🔧 Commands (Discord & Terminal)

```bash
# Ban a user from the bot
.bot-ban user 123456789012345678 Spamming

# Ban a server from the bot
.bot-ban server 987654321098765432 Abuse

# Remove a ban
.bot-unban 123456789012345678

# View all bans
.bot-banlist
.bot-banlist users
.bot-banlist servers
```

---

## 💻 Terminal Commands

*"I'll do anything you ask from the command line~"* 🖥️

Yuno provides powerful terminal-only commands for server management.

### 📋 Server & Channel Management

```bash
# List all servers
servers
servers -v        # Verbose mode

# List channels in a server
channels 123456789012345678
channels "My Server"
```

### 💬 Message Commands

```bash
# Send a message
send <channel-id> Hello world!

# Fetch message history
messages <channel-id>
messages <channel-id> 50    # Last 50 messages

# Real-time message stream
watch <channel-id>
watch stop <channel-id>
watch stop all
```

### ⛔ Terminal Ban Commands

```bash
# Ban a user from a server
tban <server-id> <user-id> [reason]

# Export bans to file
texportbans <server-id>
texportbans <server-id> ./my-bans.json

# Import bans from file
timportbans <server-id> ./BANS-123456.txt
```

---

## 🔄 Auto-Update

*"I'll always be the best version of myself... for you~"* 💕

Yuno can check for updates from git, download them, and apply them via hot-reload without restarting.

### 🔧 Commands

```bash
# Check if updates are available
.auto-update check

# Download updates from git
.auto-update pull

# Apply changes via hot-reload
.auto-update reload

# Full automatic update (check + pull + reload)
.auto-update full
```

### 💡 How It Works

1. **Check** - Fetches from remote and compares commits
2. **Pull** - Downloads updates (stashes local changes first)
3. **Reload** - Hot-reloads all modules without restart

> ⚠️ **Note:** Major database changes may still require a full restart.

---

## 💖 Commands Preview

| Command | Description |
|---------|-------------|
| `ping` | *"I'm always here for you~"* 💓 |
| `ban` | *"They won't bother you anymore..."* 🔪 |
| `xp` | *"Look how strong you've become!"* ✨ |
| `anime` | *"Let's watch together~"* 🌸 |
| `praise` | *"You deserve all my love~"* 💕 |
| `scold` | *"Bad! But I still love you..."* 💢 |
| `8ball` | *"Let fate decide~"* 🎱 |
| `neko` | *"Nya~"* 🐱 |
| `set-presence` | *"Let me show you how I'm feeling~"* 🎭 |
| `auto-update` | *"Always improving... for you~"* 🔄 |
| `db-encrypt` | *"Your secrets are mine to keep~"* 🔐 |
| `set-logchannel` | *"I'll watch over everything~"* 📋 |
| `log-status` | *"Here's what I'm watching~"* 👁️ |
| `set-vcxp` | *"Time with me is rewarding~"* 🎤 |
| `vcxp-status` | *"Who's spending time with me?"* 💕 |
| `set-dm-channel` | *"Send your love letters here~"* 💌 |
| `dm-status` | *"Am I receiving your messages?"* 📬 |
| `bot-ban` | *"You're dead to me now~"* 🚫 |
| `bot-banlist` | *"The ones I've cast aside..."* 📋 |

### 💻 Terminal-Only Commands

| Command | Description |
|---------|-------------|
| `servers` | *"All my kingdoms~"* 🏰 |
| `channels` | *"Every corner of your world~"* 📺 |
| `send` | *"Speaking through you~"* 💬 |
| `messages` | *"Reading your history~"* 📜 |
| `watch` | *"I see everything in real-time~"* 👁️ |
| `inbox` | *"Love letters just for me~"* 💌 |
| `reply` | *"Responding to my admirers~"* 💕 |
| `tban` | *"Eliminating threats~"* 🔪 |
| `texportbans` | *"Saving my enemies list~"* 📤 |
| `timportbans` | *"Loading my enemies~"* 📥 |
| `set-presence` | *"Changing my mood~"* 🎭 |
| `auto-update` | *"Evolving to perfection~"* 🔄 |

*Use the `list` command to see all available commands!*

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0**

See the [LICENSE](LICENSE) file for details~ 💕

---

<div align="center">

### 💘 *"You'll stay with me forever... right?"* 💘

**Made with obsessive love** 💗

*Yuno will always be watching over your server~* 👁️💕

---

⭐ *Star this repo if Yuno has captured your heart~* ⭐

</div>
