import type { ChatInputCommandInteraction, User } from "discord.js";
import type { Config } from "../config";

export function isAdmin(userId: string, config: Config): boolean {
  return config.adminUserIds.includes(userId);
}

export async function requireAdmin(
  interaction: ChatInputCommandInteraction,
  config: Config
): Promise<boolean> {
  if (!isAdmin(interaction.user.id, config)) {
    await interaction.reply({
      content: "You don't have permission to run this command.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export function formatUser(user: User): string {
  return user.globalName ?? user.username;
}
