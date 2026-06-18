import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "./types";
import type { Exercise } from "../db/queries";
import {
  getActiveChallenge,
  getExerciseByName,
  getExercises,
  getExerciseSubmissions,
  getLeaderboard,
  getParticipantsWithGoals,
  getParticipantsWithGoalsForExercise,
} from "../db/queries";
import { exerciseLeaderboardEmbed, leaderboardEmbed } from "../utils/embeds";

const PAGE_SIZE = 10;

type OverallEntry = { userId: string; totalPoints: number; maxPoints: number };
type ExerciseEntry = {
  userId: string;
  points: number;
  value: number | null;
};

function sortExerciseEntries(
  entries: ExerciseEntry[],
  direction: Exercise["direction"]
): ExerciseEntry[] {
  return [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.value === null && b.value === null) return a.userId.localeCompare(b.userId);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    if (direction === "higher") {
      return b.value - a.value || a.userId.localeCompare(b.userId);
    }
    return a.value - b.value || a.userId.localeCompare(b.userId);
  });
}

function buildOverallLeaderboardPage(
  challengeName: string,
  allEntries: OverallEntry[],
  page: number
) {
  const totalPages = Math.max(1, Math.ceil(allEntries.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = allEntries.slice(start, start + PAGE_SIZE);

  const entries = slice.map((e, i) => ({
    rank: start + i + 1,
    userId: e.userId,
    totalPoints: e.totalPoints,
    maxPoints: e.maxPoints,
  }));

  const embed = leaderboardEmbed(challengeName, entries, safePage, totalPages);
  const components = buildPaginationButtons("overall", safePage, totalPages);

  return { embed, components, totalPages, safePage };
}

function buildExerciseLeaderboardPage(
  challengeName: string,
  exercise: Exercise,
  allEntries: ExerciseEntry[],
  page: number
) {
  const totalPages = Math.max(1, Math.ceil(allEntries.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = allEntries.slice(start, start + PAGE_SIZE);

  const entries = slice.map((e, i) => ({
    rank: start + i + 1,
    userId: e.userId,
    points: e.points,
    value: e.value,
  }));

  const embed = exerciseLeaderboardEmbed(
    challengeName,
    exercise,
    entries,
    safePage,
    totalPages
  );
  const components = buildPaginationButtons(
    `exercise:${exercise.id}`,
    safePage,
    totalPages
  );

  return { embed, components, totalPages, safePage };
}

function buildPaginationButtons(scope: string, page: number, totalPages: number) {
  if (totalPages <= 1) return [];

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`leaderboard_page:${scope}:${page - 1}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`leaderboard_page:${scope}:${page + 1}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages)
    ),
  ];
}

function getOverallEntries(
  db: Parameters<Command["execute"]>[1]["db"],
  challengeId: number,
  maxPoints: number
): OverallEntry[] {
  const scores = getLeaderboard(db, challengeId);
  const participants = getParticipantsWithGoals(db, challengeId);
  const scoreMap = new Map(scores.map((s) => [s.user_id, s.total_points]));

  return participants
    .map((userId) => ({
      userId,
      totalPoints: scoreMap.get(userId) ?? 0,
      maxPoints,
    }))
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints || a.userId.localeCompare(b.userId)
    );
}

function getExerciseEntries(
  db: Parameters<Command["execute"]>[1]["db"],
  challengeId: number,
  exercise: Exercise
): ExerciseEntry[] {
  const submissions = getExerciseSubmissions(db, challengeId, exercise.id);
  const submissionMap = new Map(
    submissions.map((s) => [
      s.user_id,
      { points: s.points, value: s.value },
    ])
  );
  const participants = getParticipantsWithGoalsForExercise(
    db,
    challengeId,
    exercise.id
  );

  return sortExerciseEntries(
    participants.map((userId) => {
      const submission = submissionMap.get(userId);
      return {
        userId,
        points: submission?.points ?? 0,
        value: submission?.value ?? null,
      };
    }),
    exercise.direction
  );
}

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the challenge leaderboard")
    .addStringOption((opt) =>
      opt
        .setName("exercise")
        .setDescription("Show leaderboard for a specific exercise")
        .setAutocomplete(true)
    ),

  async autocomplete(interaction, { db }) {
    const focused = interaction.options.getFocused().toLowerCase();
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.respond([]);
      return;
    }

    const exercises = getExercises(db, challenge.id);
    const choices = exercises
      .filter((e) => e.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((e) => ({ name: e.name, value: e.name }));

    await interaction.respond(choices);
  },

  async execute(interaction, { db }) {
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.reply({
        content: "There is no active challenge right now.",
        ephemeral: true,
      });
      return;
    }

    const exerciseName = interaction.options.getString("exercise");

    if (exerciseName) {
      const exercise = getExerciseByName(db, challenge.id, exerciseName);
      if (!exercise) {
        await interaction.reply({
          content: `Exercise **${exerciseName}** not found.`,
          ephemeral: true,
        });
        return;
      }

      const allEntries = getExerciseEntries(db, challenge.id, exercise);
      if (allEntries.length === 0) {
        await interaction.reply({
          content: `No participants with goals set for **${exercise.name}** yet.`,
          ephemeral: true,
        });
        return;
      }

      const { embed, components } = buildExerciseLeaderboardPage(
        challenge.name,
        exercise,
        allEntries,
        1
      );

      await interaction.reply({ embeds: [embed], components });
      return;
    }

    const exercises = getExercises(db, challenge.id);
    const maxPoints = exercises.length * 5;
    const allEntries = getOverallEntries(db, challenge.id, maxPoints);

    if (allEntries.length === 0) {
      await interaction.reply({
        content: "No participants with goals set yet.",
        ephemeral: true,
      });
      return;
    }

    const { embed, components } = buildOverallLeaderboardPage(
      challenge.name,
      allEntries,
      1
    );

    await interaction.reply({ embeds: [embed], components });
  },

  async handleButton(interaction, { db }) {
    if (!interaction.customId.startsWith("leaderboard_page:")) return false;

    const parts = interaction.customId.split(":");
    const scope = parts[1];
    const challenge = getActiveChallenge(db);
    if (!challenge) {
      await interaction.update({
        content: "There is no active challenge.",
        embeds: [],
        components: [],
      });
      return true;
    }

    if (scope === "overall") {
      const page = parseInt(parts[2], 10);
      const exercises = getExercises(db, challenge.id);
      const maxPoints = exercises.length * 5;
      const allEntries = getOverallEntries(db, challenge.id, maxPoints);

      const { embed, components, totalPages, safePage } =
        buildOverallLeaderboardPage(challenge.name, allEntries, page);

      if (safePage < 1 || safePage > totalPages) {
        await interaction.deferUpdate();
        return true;
      }

      await interaction.update({ embeds: [embed], components });
      return true;
    }

    if (scope === "exercise") {
      const exerciseId = parseInt(parts[2], 10);
      const page = parseInt(parts[3], 10);
      const exercise = getExercises(db, challenge.id).find(
        (e) => e.id === exerciseId
      );
      if (!exercise) {
        await interaction.update({
          content: "Exercise not found.",
          embeds: [],
          components: [],
        });
        return true;
      }

      const allEntries = getExerciseEntries(db, challenge.id, exercise);
      const { embed, components, totalPages, safePage } =
        buildExerciseLeaderboardPage(
          challenge.name,
          exercise,
          allEntries,
          page
        );

      if (safePage < 1 || safePage > totalPages) {
        await interaction.deferUpdate();
        return true;
      }

      await interaction.update({ embeds: [embed], components });
      return true;
    }

    return false;
  },
};
