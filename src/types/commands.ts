import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
