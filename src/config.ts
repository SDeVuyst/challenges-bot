import "dotenv/config";

export interface Config {
  discordToken: string;
  discordClientId: string;
  guildId?: string;
  adminUserIds: string[];
  databasePath: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  const adminUserIds = requireEnv("ADMIN_USER_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (adminUserIds.length === 0) {
    throw new Error("ADMIN_USER_IDS must contain at least one Discord user ID");
  }

  return {
    discordToken: requireEnv("DISCORD_TOKEN"),
    discordClientId: requireEnv("DISCORD_CLIENT_ID"),
    guildId: process.env.GUILD_ID,
    adminUserIds,
    databasePath: process.env.DATABASE_PATH ?? "/data/challenge.db",
  };
}
