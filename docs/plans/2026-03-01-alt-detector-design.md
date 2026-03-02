# Alt Detector Design

**Date:** 2026-03-01
**Feature:** Alt account detection using `discord-alt-detector`

---

## Overview

Add alt account detection to Yuno bot with two modes:
1. **Automatic** — detect suspicious members on join and apply configured actions
2. **On-demand** — scan all existing guild members and bulk-act on flagged users

---

## Package

`discord-alt-detector@1.0.4` — scores members across: account age, avatar/banner presence, Nitro, badges, username patterns, presence. Returns a suspicion score and trust category.

Trust categories (low to high suspicion):
- `highly-trusted`, `trusted`, `normal`, `newbie`, `suspicious`, `highly-suspicious`, `mega-suspicious`

Actionable levels in this feature: `newbie`, `suspicious`, `highly-suspicious`, `mega-suspicious`

---

## Database

New table `altDetectorConfig` added to `DatabaseCommands.js` via `CREATE TABLE IF NOT EXISTS` (safe for both new and existing databases):

```sql
CREATE TABLE IF NOT EXISTS altDetectorConfig (
  gid TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  logChannelId TEXT,
  quarantineRoleId TEXT,
  actionNewbie TEXT DEFAULT 'none',
  actionSuspicious TEXT DEFAULT 'log',
  actionHighlySuspicious TEXT DEFAULT 'log',
  actionMegaSuspicious TEXT DEFAULT 'ban'
)
```

Valid action values: `'none'` | `'log'` | `'kick'` | `'ban'` | `'role'`

Cached in LRU cache (consistent with existing guild config caching patterns).

---

## Files Changed / Created

| File | Change |
|---|---|
| `package.json` | Add `discord-alt-detector` to dependencies |
| `src/database.js` / `DatabaseCommands.js` | Add `altDetectorConfig` table creation and CRUD methods |
| `src/modules/alt-detector.js` | New — join detection module |
| `src/commands/alt-detector.js` | New — config command |
| `src/commands/scan-alts.js` | New — member scan command |
| `src/modules/slash-commands.js` | Register `/alt-detector` and `/scan-alts` slash commands |
| `index.js` (or bot init) | Verify `GuildMembers` + `GuildPresences` intents present |

---

## Module: `src/modules/alt-detector.js`

- Listens on `guildMemberAdd`
- Reads `altDetectorConfig` for the guild (LRU-cached)
- If `enabled = 0` or no config row → skip
- Runs `detector.check(member)` → maps category to configured action
- Actions:
  - `log` — post embed to `logChannelId` with member info + score + category
  - `kick` — kick member with reason "Alt account detected (score: X)"
  - `ban` — ban member (0 days message deletion) with reason
  - `role` — assign `quarantineRoleId` to member
- All actions wrapped in try/catch, errors logged to console (missing perms, closed DMs, etc.)
- Requires `GuildMembers` and `GuildPresences` gateway intents

---

## Command: `src/commands/alt-detector.js`

Permission required: `ManageGuild`

Subcommands:
- `enable` — set `enabled = 1`
- `disable` — set `enabled = 0`
- `setchannel <#channel>` — set `logChannelId`
- `setrole <@role>` — set `quarantineRoleId`
- `setaction <level> <action>` — set action for a severity level
  - `level`: `newbie` | `suspicious` | `highly-suspicious` | `mega-suspicious`
  - `action`: `none` | `log` | `kick` | `ban` | `role`
- `status` — embed showing current config (enabled state, channel, role, per-level actions)

---

## Command: `src/commands/scan-alts.js`

Permission required: `ManageGuild`

Behavior:
1. Fetch all guild members in chunks using `guild.members.fetch()` with pagination
2. Use `rateLimitHelper` for dynamic delays between API calls (same pattern as `scan-bans.js`)
3. Run `detector.check(member)` on each member
4. Collect flagged members (category = suspicious or above) grouped by severity
5. Post results embed: member count scanned, flagged count, breakdown by severity with member list
6. Follow with a select menu (Discord component): `Kick all flagged` | `Ban all flagged` | `Assign quarantine role` | `Do nothing`
7. On selection: apply action to all flagged members with rate-limit awareness
8. Works regardless of whether auto-detection is enabled

Also registered as slash command `/scan-alts` in `slash-commands.js`.

---

## Slash Commands

Two new entries added to `slash-commands.js`:

```
/alt-detector <subcommand> [args]
/scan-alts
```

Both map to their respective text command handlers via the existing `COMMAND_HANDLERS` pattern.

---

## Intent Requirements

`GuildMembers` — required for member data on join (likely already enabled for auto-role-restore).
`GuildPresences` — required for presence-based scoring. May need to be added.

Check and add in the bot client initialization if not present.

---

## Non-Goals

- No IP-based detection (not available via Discord API)
- No cross-server tracking
- No automatic DM to detected users
