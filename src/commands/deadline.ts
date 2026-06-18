import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./types";
import { getActiveChallenge } from "../db/queries";
import { deadlineEmbed } from "../utils/embeds";

export const deadlineCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("deadline")
    .setDescription("Show the challenge deadline and time remaining"),

  async execute(interaction, { db }) {
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge right now.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ embeds: [deadlineEmbed(challenge)] });
  },
};
