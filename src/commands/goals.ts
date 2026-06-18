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
  setUserGoals,
} from "../db/queries";
import { parseThreshold, validateGoalTiers } from "../scoring/floorTier";
import { goalsEmbed } from "../utils/embeds";
import { formatUser } from "../utils/permissions";

export const goalsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("goals")
    .setDescription("View or set per-user exercise goals")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set tier goals for a user on an exercise (admin)")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The participant").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View goals for a user")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The participant (defaults to you)")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("exercise")
            .setDescription("Exercise name")
            .setRequired(false)
            .setAutocomplete(true)
        )
    ),

  async execute(interaction, { db, config }) {
    const sub = interaction.options.getSubcommand();
    const challenge = getActiveChallenge(db);

    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge right now.",
        ephemeral: true,
      });
      return;
    }

    if (sub === "set") {
      if (!config.adminUserIds.includes(interaction.user.id)) {
        await interaction.reply({
          content: "You don't have permission to run this command.",
          ephemeral: true,
        });
        return;
      }

      const user = interaction.options.getUser("user", true);
      const exercises = getExercises(db, challenge.id);

      if (exercises.length === 0) {
        await interaction.reply({
          content: "No exercises yet. Add some with `/exercise add` first.",
          ephemeral: true,
        });
        return;
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`goals_set_exercise:${user.id}`)
        .setPlaceholder("Select an exercise")
        .addOptions(
          exercises.map((e) => ({
            label: e.name,
            description: `${e.unit} — ${e.direction}`,
            value: String(e.id),
          }))
        );

      await interaction.reply({
        content: `Select an exercise to set goals for **${formatUser(user)}**:`,
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "view") {
      const user = interaction.options.getUser("user") ?? interaction.user;
      const exerciseName = interaction.options.getString("exercise");
      const exercises = getExercises(db, challenge.id);

      if (exercises.length === 0) {
        await interaction.reply({
          content: "No exercises in this challenge yet.",
          ephemeral: true,
        });
        return;
      }

      if (exerciseName) {
        const exercise = exercises.find(
          (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
        );
        if (!exercise) {
          await interaction.reply({
            content: `Exercise "${exerciseName}" not found.`,
            ephemeral: true,
          });
          return;
        }

        const goals = getUserGoals(db, challenge.id, user.id, exercise.id);
        if (goals.length === 0) {
          await interaction.reply({
            content: `No goals set for **${formatUser(user)}** on **${exercise.name}**.`,
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          embeds: [goalsEmbed(formatUser(user), exercise, goals)],
        });
        return;
      }

      const allGoals = getUserGoals(db, challenge.id, user.id);
      if (allGoals.length === 0) {
        await interaction.reply({
          content: `No goals set for **${formatUser(user)}** yet.`,
          ephemeral: true,
        });
        return;
      }

      const embeds = exercises
        .map((exercise) => {
          const goals = allGoals.filter((g) => g.exercise_id === exercise.id);
          if (goals.length === 0) return null;
          return goalsEmbed(formatUser(user), exercise, goals);
        })
        .filter(Boolean);

      await interaction.reply({ embeds: embeds as ReturnType<typeof goalsEmbed>[] });
    }
  },

  async handleSelect(interaction, { db }) {
    if (!interaction.customId.startsWith("goals_set_exercise:")) return false;

    const userId = interaction.customId.split(":")[1];
    const exerciseId = parseInt(interaction.values[0], 10);

    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge.",
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
      .setCustomId(`goals_set_modal:${userId}:${exerciseId}`)
      .setTitle(`Goals: ${exercise.name}`);

    const tierFields = [1, 2, 3, 4, 5].map((tier) =>
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`tier_${tier}`)
          .setLabel(`Tier ${tier} threshold (${exercise.unit})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(
            exercise.direction === "higher" ? "e.g. 5" : "e.g. 25"
          )
          .setRequired(true)
          .setMaxLength(10)
      )
    );

    modal.addComponents(...tierFields);
    await interaction.showModal(modal);
    return true;
  },

  async handleModal(interaction, { db }) {
    if (!interaction.customId.startsWith("goals_set_modal:")) return false;

    const [, userId, exerciseIdStr] = interaction.customId.split(":");
    const exerciseId = parseInt(exerciseIdStr, 10);

    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge.",
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

    const tiers = [1, 2, 3, 4, 5].map((tier) => {
      const raw = interaction.fields.getTextInputValue(`tier_${tier}`);
      const threshold = parseThreshold(raw);
      return { tier, threshold: threshold ?? NaN };
    });

    const validationError = validateGoalTiers(tiers, exercise.direction);
    if (validationError) {
      await interaction.reply({ content: validationError, ephemeral: true });
      return true;
    }

    setUserGoals(db, challenge.id, userId, exerciseId, tiers);

    const user = await interaction.client.users.fetch(userId);
    await interaction.reply({
      embeds: [
        goalsEmbed(formatUser(user), exercise, tiers.map((t) => ({
          challenge_id: challenge.id,
          user_id: userId,
          exercise_id: exerciseId,
          tier: t.tier,
          threshold: t.threshold,
        }))),
      ],
    });

    return true;
  },

  async autocomplete(interaction, { db }) {
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused().toLowerCase();
    const exercises = getExercises(db, challenge.id);
    const filtered = exercises
      .filter((e) => e.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((e) => ({ name: e.name, value: e.name }));

    await interaction.respond(filtered);
  },
};
