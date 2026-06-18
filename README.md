# Gym Challenge Discord Bot

A Discord bot for running personalized gym challenges between friends. Each participant gets their own tier thresholds (1–5 points) per exercise, so everyone competes on a level playing field.

## Features

- **Per-user goals** — different tier thresholds for each Discord user on each exercise
- **Floor-tier scoring** — you earn the highest tier you've fully achieved
- **Interactive commands** — modals and select menus for easy setup and submissions
- **Leaderboard** — ranked standings with pagination
- **No hosted database** — SQLite file stored in a Docker volume

## Commands

| Command | Description |
|---------|-------------|
| `/challenge create` | Create a new challenge (admin) |
| `/challenge end` | End the active challenge (admin) |
| `/challenge info` | Show current challenge details |
| `/exercise add` | Add an exercise (admin) |
| `/exercise list` | List all exercises |
| `/goals set` | Set tier goals for a user on an exercise (admin) |
| `/goals view` | View a user's tier goals |
| `/submit` | Submit your result for an exercise |
| `/score` | View score breakdown (self or another user) |
| `/leaderboard` | View ranked standings |
| `/deadline` | Show deadline and time remaining |

## Setup

### 1. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Open **Bot** → **Reset Token** → copy the token
4. Under **Privileged Gateway Intents**, you only need the defaults (no extra intents required)
5. Open **OAuth2** → **URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`
6. Copy the generated invite URL and add the bot to your server

### 2. Get your IDs

- **Application ID** (`DISCORD_CLIENT_ID`): Developer Portal → General Information
- **Server ID** (`GUILD_ID`): Right-click your server → Copy Server ID (enable Developer Mode in Discord settings first)
- **Your user ID** (`ADMIN_USER_IDS`): Right-click your profile → Copy User ID

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
GUILD_ID=your_server_id
ADMIN_USER_IDS=your_discord_user_id
DATABASE_PATH=/data/challenge.db
```

`GUILD_ID` makes slash commands appear instantly on your server during development. Remove it for global command registration (can take up to an hour).

### 4. Run with Docker

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f bot
```

Stop:

```bash
docker compose down
```

The SQLite database is stored in the `challenge-data` Docker volume and persists across restarts.

### 5. Run locally (development)

```bash
npm install
npm run dev
```

Set `DATABASE_PATH=./data/challenge.db` in `.env` for local development.

## Example workflow

1. **Admin** runs `/challenge create` → name: "Summer Grind", deadline: `2026-08-31`
2. **Admin** runs `/exercise add` for each exercise:
   - Muscle-ups — unit: `reps`, direction: `higher`
   - Bench press — unit: `kg`, direction: `higher`
   - 5K run — unit: `min`, direction: `lower`
3. **Admin** runs `/goals set` for each friend on each exercise, entering 5 tier thresholds
4. **Friends** run `/submit` when they hit a PR
5. Anyone runs `/leaderboard`, `/score @friend`, or `/deadline`

## Example goals

**Person A — Muscle-ups** (higher is better):

| Tier | Threshold |
|------|-----------|
| 1 pt | 1 rep |
| 2 pt | 3 reps |
| 3 pt | 5 reps |
| 4 pt | 8 reps |
| 5 pt | 10 reps |

**Person B — Muscle-ups** (higher is better):

| Tier | Threshold |
|------|-----------|
| 1 pt | 3 reps |
| 2 pt | 5 reps |
| 3 pt | 8 reps |
| 4 pt | 12 reps |
| 5 pt | 15 reps |

If Person A does 6 muscle-ups → **3 points** (floor tier). If Person B does 6 → **1 point**.

**5K run** (lower is better) — thresholds must decrease from tier 1 to tier 5:

| Tier | Threshold |
|------|-----------|
| 1 pt | 30 min |
| 2 pt | 27 min |
| 3 pt | 24 min |
| 4 pt | 22 min |
| 5 pt | 20 min |

## Scoring

- **Higher is better** (reps, weight): tier N counts if `result >= threshold[N]`
- **Lower is better** (time): tier N counts if `result <= threshold[N]`
- **Total score** = sum of points across all exercises (max 5 per exercise)
- Resubmitting overwrites your previous entry for that exercise

## Backup

To back up the database:

```bash
docker compose exec bot cp /data/challenge.db /data/challenge.db.backup
```

Or copy from the volume directly.

## License

MIT
