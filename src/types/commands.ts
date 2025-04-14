import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<any>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
