import { EmbedBuilder } from "discord.js";
import type { Challenge, Exercise, UserGoal } from "../db/queries";

function formatDeadlineTimestamp(deadline: Date): string {
  const unix = Math.floor(deadline.getTime() / 1000);
  return `<t:${unix}:D> (<t:${unix}:R>)`;
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("Error")
    .setDescription(message);
}

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(title)
    .setDescription(description);
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description);
}

export function challengeEmbed(challenge: Challenge): EmbedBuilder {
  const deadline = new Date(challenge.deadline);
  const passed = deadline.getTime() <= Date.now();

  return new EmbedBuilder()
    .setColor(passed ? 0xed4245 : 0x57f287)
    .setTitle(`Challenge: ${challenge.name}`)
    .addFields(
      {
        name: "Deadline",
        value: formatDeadlineTimestamp(deadline),
        inline: true,
      },
      { name: "Status", value: challenge.status, inline: true }
    );
}

export function goalsEmbed(
  userTag: string,
  exercise: Exercise,
  goals: UserGoal[]
): EmbedBuilder {
  const sorted = [...goals].sort((a, b) => a.tier - b.tier);
  const lines = sorted.map(
    (g) => `**${g.tier} pt** — ${g.threshold} ${exercise.unit}`
  );

  const directionHint =
    exercise.direction === "higher"
      ? "Higher is better"
      : "Lower is better (faster)";

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Goals: ${exercise.name}`)
    .setDescription(`**${userTag}** — ${directionHint}`)
    .addFields({ name: "Tier thresholds", value: lines.join("\n") });
}

export function scoreEmbed(
  userTag: string,
  challengeName: string,
  scores: {
    exercise_name: string;
    unit: string;
    value: number | null;
    points: number;
    max_points: number;
  }[],
  totalPoints: number
): EmbedBuilder {
  const maxTotal = scores.length * 5;
  const lines = scores.map((s) => {
    const result =
      s.value !== null ? `${s.value} ${s.unit}` : "_not submitted_";
    return `**${s.exercise_name}**: ${result} → **${s.points}/${s.max_points}** pts`;
  });

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`Score: ${userTag}`)
    .setDescription(`Challenge: **${challengeName}**`)
    .addFields(
      { name: "Breakdown", value: lines.join("\n") || "_No exercises yet_" },
      {
        name: "Total",
        value: `**${totalPoints}/${maxTotal}** points`,
        inline: true,
      }
    );
}

export function leaderboardEmbed(
  challengeName: string,
  entries: { rank: number; userId: string; totalPoints: number; maxPoints: number }[],
  page: number,
  totalPages: number
): EmbedBuilder {
  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((e) => {
    const medal = e.rank <= 3 ? medals[e.rank - 1] + " " : "";
    return `${medal}**#${e.rank}** <@${e.userId}> — **${e.totalPoints}/${e.maxPoints}** pts`;
  });

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`Leaderboard: ${challengeName}`)
    .setDescription(lines.join("\n") || "_No submissions yet_")
    .setFooter({ text: `Page ${page}/${totalPages}` });
}

export function deadlineEmbed(challenge: Challenge): EmbedBuilder {
  const deadline = new Date(challenge.deadline);
  const passed = deadline.getTime() <= Date.now();

  return new EmbedBuilder()
    .setColor(passed ? 0xed4245 : 0x57f287)
    .setTitle(`Deadline: ${challenge.name}`)
    .setDescription(
      passed
        ? "The deadline has **passed**. Submissions are closed."
        : `Time remaining: <t:${Math.floor(deadline.getTime() / 1000)}:R>`
    )
    .addFields({
      name: "Deadline",
      value: formatDeadlineTimestamp(deadline),
    });
}

const TIER_CELEBRATIONS: Record<number, string> = {
  1: "🎉 Great start!",
  2: "🔥 Nice work!",
  3: "💪 Solid progress!",
  4: "⚡ Crushing it!",
  5: "🏆 Maximum points!",
};

export function submissionCelebrationEmbed(
  userId: string,
  exercise: Exercise,
  value: number,
  points: number,
  previousPoints: number | null
): EmbedBuilder {
  const celebration = TIER_CELEBRATIONS[points] ?? "🎉 Submission recorded!";
  const improved =
    previousPoints !== null && points > previousPoints
      ? `\n📈 Up from **${previousPoints}** to **${points}** points!`
      : "";

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(celebration)
    .setDescription(
      `<@${userId}> scored on **${exercise.name}**!\n\n` +
        `**${value}** ${exercise.unit} → **${points}/5** points${improved}`
    );
}

export function exerciseLeaderboardEmbed(
  challengeName: string,
  exercise: Exercise,
  entries: {
    rank: number;
    userId: string;
    points: number;
    value: number | null;
  }[],
  page: number,
  totalPages: number
): EmbedBuilder {
  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((e) => {
    const medal = e.rank <= 3 ? medals[e.rank - 1] + " " : "";
    const result =
      e.value !== null ? `${e.value} ${exercise.unit}` : "_not submitted_";
    return `${medal}**#${e.rank}** <@${e.userId}> — **${e.points}/5** pts (${result})`;
  });

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`Leaderboard: ${exercise.name}`)
    .setDescription(`Challenge: **${challengeName}**`)
    .addFields({
      name: "Rankings",
      value: lines.join("\n") || "_No participants yet_",
    })
    .setFooter({ text: `Page ${page}/${totalPages}` });
}
