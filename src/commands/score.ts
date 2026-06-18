import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./types";
import { getActiveChallenge, getUserExerciseScores } from "../db/queries";
import { scoreEmbed } from "../utils/embeds";
import { formatUser } from "../utils/permissions";

export const scoreCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("score")
    .setDescription("View a participant's score breakdown")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The participant (defaults to you)")
        .setRequired(false)
    ),

  async execute(interaction, { db }) {
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge right now.",
        ephemeral: true,
      });
      return;
    }

    const user = interaction.options.getUser("user") ?? interaction.user;
    const scores = getUserExerciseScores(db, challenge.id, user.id);
    const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);

    await interaction.reply({
      embeds: [
        scoreEmbed(formatUser(user), challenge.name, scores, totalPoints),
      ],
    });
  },
};
