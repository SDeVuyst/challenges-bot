import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "./types";
import {
  getActiveChallenge,
  getExercises,
  getUserGoals,
  getSubmission,
  hasUserGoalsForExercise,
  isDeadlinePassed,
  upsertSubmission,
} from "../db/queries";
import { calculateFloorTierPoints } from "../scoring/floorTier";
import { submissionCelebrationEmbed } from "../utils/embeds";

export const submitCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Submit your result for an exercise"),

  async execute(interaction, { db }) {
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge right now.",
        ephemeral: true,
      });
      return;
    }

    if (isDeadlinePassed(challenge.deadline)) {
      await interaction.reply({
        content: "The deadline has passed. Submissions are closed.",
        ephemeral: true,
      });
      return;
    }

    const exercises = getExercises(db, challenge.id);
    if (exercises.length === 0) {
      await interaction.reply({
        content: "No exercises in this challenge yet.",
        ephemeral: true,
      });
      return;
    }

    const userId = interaction.user.id;
    const exercisesWithGoals = exercises.filter((e) =>
      hasUserGoalsForExercise(db, challenge.id, userId, e.id)
    );

    if (exercisesWithGoals.length === 0) {
      await interaction.reply({
        content:
          "No goals have been set for you yet. Ask an admin to set your goals with `/goals set`.",
        ephemeral: true,
      });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("submit_exercise_select")
      .setPlaceholder("Select an exercise")
      .addOptions(
        exercisesWithGoals.map((e) => ({
          label: e.name,
          description: `${e.unit} — ${e.direction}`,
          value: String(e.id),
        }))
      );

    await interaction.reply({
      content: "Select the exercise you want to submit a result for:",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      ],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, { db }) {
    if (interaction.customId !== "submit_exercise_select") return false;

    const exerciseId = parseInt(interaction.values[0], 10);
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge.",
        ephemeral: true,
      });
      return true;
    }

    if (isDeadlinePassed(challenge.deadline)) {
      await interaction.reply({
        content: "The deadline has passed. Submissions are closed.",
        ephemeral: true,
      });
      return true;
    }

    const exercises = getExercises(db, challenge.id);
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (!exercise) {
      await interaction.reply({ content: "Exercise not found.", ephemeral: true });
      return true;
    }

    const modal = new ModalBuilder()
      .setCustomId(`submit_modal:${exerciseId}`)
      .setTitle(`Submit: ${exercise.name}`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("value")
          .setLabel(`Your result (${exercise.unit})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(
            exercise.direction === "higher" ? "e.g. 6" : "e.g. 22.5"
          )
          .setRequired(true)
          .setMaxLength(10)
      )
    );

    await interaction.showModal(modal);
    return true;
  },

  async handleModal(interaction, { db }) {
    if (!interaction.customId.startsWith("submit_modal:")) return false;

    const exerciseId = parseInt(interaction.customId.split(":")[1], 10);
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge.",
        ephemeral: true,
      });
      return true;
    }

    if (isDeadlinePassed(challenge.deadline)) {
      await interaction.reply({
        content: "The deadline has passed. Submissions are closed.",
        ephemeral: true,
      });
      return true;
    }

    const exercises = getExercises(db, challenge.id);
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (!exercise) {
      await interaction.reply({ content: "Exercise not found.", ephemeral: true });
      return true;
    }

    const rawValue = interaction.fields.getTextInputValue("value").trim();
    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) {
      await interaction.reply({
        content: "Please enter a valid number.",
        ephemeral: true,
      });
      return true;
    }

    const userId = interaction.user.id;
    const goals = getUserGoals(db, challenge.id, userId, exerciseId);
    if (goals.length !== 5) {
      await interaction.reply({
        content: `Goals are not fully set for you on **${exercise.name}**. Ask an admin.`,
        ephemeral: true,
      });
      return true;
    }

    const points = calculateFloorTierPoints(
      value,
      goals.map((g) => ({ tier: g.tier, threshold: g.threshold })),
      exercise.direction
    );

    const previous = getSubmission(db, challenge.id, userId, exerciseId);
    const previousPoints = previous?.points ?? null;

    upsertSubmission(db, challenge.id, userId, exerciseId, value, points);

    if (points > 0) {
      await interaction.reply({
        embeds: [
          submissionCelebrationEmbed(
            userId,
            exercise,
            value,
            points,
            previousPoints
          ),
        ],
      });
    } else {
      await interaction.reply({
        content: `**${exercise.name}**: ${value} ${exercise.unit} — no tier reached yet. Keep pushing!`,
        ephemeral: true,
      });
    }

    return true;
  },
};
