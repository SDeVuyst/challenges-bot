import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "./types";
import { addExercise, getActiveChallenge } from "../db/queries";
import type { ExerciseDirection } from "../db/queries";

export const exerciseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("exercise")
    .setDescription("Manage challenge exercises")
    .addSubcommand((sub) =>
      sub.setName("add").setDescription("Add an exercise to the challenge (admin)")
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all exercises in the challenge")
    ),

  async execute(interaction, { db, config }) {
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const challenge = getActiveChallenge(db);
      if (!challenge) {
        await interaction.reply({
          content: "There is no active challenge right now.",
          ephemeral: true,
        });
        return;
      }

      const { getExercises } = await import("../db/queries");
      const exercises = getExercises(db, challenge.id);

      if (exercises.length === 0) {
        await interaction.reply({
          content: `No exercises added yet for **${challenge.name}**.`,
          ephemeral: true,
        });
        return;
      }

      const lines = exercises.map(
        (e) =>
          `• **${e.name}** (${e.unit}) — ${e.direction === "higher" ? "higher is better" : "lower is better"}`
      );

      const { infoEmbed } = await import("../utils/embeds");
      await interaction.reply({
        embeds: [
          infoEmbed(`Exercises: ${challenge.name}`, lines.join("\n")),
        ],
      });
      return;
    }

    if (sub === "add") {
      if (!config.adminUserIds.includes(interaction.user.id)) {
        await interaction.reply({
          content: "You don't have permission to run this command.",
          ephemeral: true,
        });
        return;
      }

      const challenge = getActiveChallenge(db);
      if (!challenge) {
        await interaction.reply({
          content: "There is no active challenge. Create one with `/challenge create` first.",
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("exercise_add_modal")
        .setTitle("Add Exercise");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Exercise name")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Muscle-ups")
            .setRequired(true)
            .setMaxLength(50)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("unit")
            .setLabel("Unit")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("reps, kg, min")
            .setRequired(true)
            .setMaxLength(20)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("direction")
            .setLabel("Direction (higher or lower)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("higher")
            .setRequired(true)
            .setMaxLength(6)
        )
      );

      await interaction.showModal(modal);
    }
  },

  async handleModal(interaction, { db }) {
    if (interaction.customId !== "exercise_add_modal") return false;

    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge.",
        ephemeral: true,
      });
      return true;
    }

    const name = interaction.fields.getTextInputValue("name").trim();
    const unit = interaction.fields.getTextInputValue("unit").trim();
    const directionRaw = interaction.fields
      .getTextInputValue("direction")
      .trim()
      .toLowerCase();

    if (directionRaw !== "higher" && directionRaw !== "lower") {
      await interaction.reply({
        content: 'Direction must be "higher" or "lower".',
        ephemeral: true,
      });
      return true;
    }

    const direction = directionRaw as ExerciseDirection;

    try {
      const exercise = addExercise(db, challenge.id, name, unit, direction);
      const { successEmbed } = await import("../utils/embeds");
      await interaction.reply({
        embeds: [
          successEmbed(
            "Exercise added",
            `**${exercise.name}** (${exercise.unit}, ${direction}) added to **${challenge.name}**.`
          ),
        ],
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("UNIQUE")
          ? `An exercise named "${name}" already exists.`
          : err instanceof Error
            ? err.message
            : "Failed to add exercise.";
      await interaction.reply({ content: message, ephemeral: true });
    }

    return true;
  },
};
