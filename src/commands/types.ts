import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import type Database from "better-sqlite3";
import type { Config } from "../config";

export interface CommandContext {
  db: Database.Database;
  config: Config;
}

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

export interface Command {
  data: CommandData;
  execute: (
    interaction: ChatInputCommandInteraction,
    ctx: CommandContext
  ) => Promise<void>;
  handleModal?: (
    interaction: ModalSubmitInteraction,
    ctx: CommandContext
  ) => Promise<boolean>;
  handleSelect?: (
    interaction: StringSelectMenuInteraction,
    ctx: CommandContext
  ) => Promise<boolean>;
  handleButton?: (
    interaction: ButtonInteraction,
    ctx: CommandContext
  ) => Promise<boolean>;
  autocomplete?: (
    interaction: AutocompleteInteraction,
    ctx: CommandContext
  ) => Promise<void>;
}
