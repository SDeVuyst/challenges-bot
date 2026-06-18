import { challengeCommand } from "./challenge";
import { deadlineCommand } from "./deadline";
import { exerciseCommand } from "./exercise";
import { goalsCommand } from "./goals";
import { leaderboardCommand } from "./leaderboard";
import { scoreCommand } from "./score";
import { submitCommand } from "./submit";
import type { Command } from "./types";

export const commands: Command[] = [
  challengeCommand,
  exerciseCommand,
  goalsCommand,
  submitCommand,
  scoreCommand,
  leaderboardCommand,
  deadlineCommand,
];

export function getCommandMap(): Map<string, Command> {
  return new Map(commands.map((c) => [c.data.name, c]));
}
