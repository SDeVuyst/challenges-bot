import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Command } from "./types";
import {
  createChallenge,
  endActiveChallenge,
  getActiveChallenge,
} from "../db/queries";

export const challengeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("challenge")
    .setDescription("Manage the gym challenge")
    .addSubcommand((sub) =>
      sub.setName("create").setDescription("Create a new challenge (admin)")
    )
    .addSubcommand((sub) =>
      sub.setName("end").setDescription("End the active challenge (admin)")
    )
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Show current challenge info")
    ),

  async execute(interaction, { db, config }) {
    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      if (!config.adminUserIds.includes(interaction.user.id)) {
        await interaction.reply({
          content: "You don't have permission to run this command.",
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("challenge_create_modal")
        .setTitle("Create Challenge");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Challenge name")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Summer Grind")
            .setRequired(true)
            .setMaxLength(100)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("deadline")
            .setLabel("Deadline (YYYY-MM-DD)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("2026-08-31")
            .setRequired(true)
            .setMaxLength(10)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === "end") {
      if (!config.adminUserIds.includes(interaction.user.id)) {
        await interaction.reply({
          content: "You don't have permission to run this command.",
          ephemeral: true,
        });
        return;
      }

      const ended = endActiveChallenge(db);
      if (!ended) {
        await interaction.reply({
          content: "There is no active challenge to end.",
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `Challenge **${ended.name}** has been ended.`,
      });
      return;
    }

    if (sub === "info") {
      const challenge = getActiveChallenge(db);
      if (!challenge) {
        await interaction.reply({
          content: "There is no active challenge right now.",
          ephemeral: true,
        });
        return;
      }

      const { challengeEmbed } = await import("../utils/embeds");
      await interaction.reply({ embeds: [challengeEmbed(challenge)] });
    }
  },

  async handleModal(interaction, { db }) {
    if (interaction.customId !== "challenge_create_modal") return false;

    const name = interaction.fields.getTextInputValue("name").trim();
    const deadlineInput = interaction.fields.getTextInputValue("deadline").trim();
    const deadline = new Date(`${deadlineInput}T23:59:59`);

    if (isNaN(deadline.getTime())) {
      await interaction.reply({
        content: "Invalid deadline. Use format YYYY-MM-DD (e.g. 2026-08-31).",
        ephemeral: true,
      });
      return true;
    }

    if (deadline.getTime() <= Date.now()) {
      await interaction.reply({
        content: "Deadline must be in the future.",
        ephemeral: true,
      });
      return true;
    }

    try {
      const challenge = createChallenge(db, name, deadline.toISOString());
      const { successEmbed } = await import("../utils/embeds");
      await interaction.reply({
        embeds: [
          successEmbed(
            "Challenge created",
            `**${challenge.name}** is now active.\nDeadline: <t:${Math.floor(deadline.getTime() / 1000)}:F>\n\nNext: add exercises with \`/exercise add\`.`
          ),
        ],
      });
    } catch (err) {
      await interaction.reply({
        content: err instanceof Error ? err.message : "Failed to create challenge.",
        ephemeral: true,
      });
    }

    return true;
  },
};
