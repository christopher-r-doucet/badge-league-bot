import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, AutocompleteInteraction, ButtonInteraction } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<any>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  handleComponent?: (interaction: ButtonInteraction) => Promise<void>;
  cancelMatch?: (interaction: ButtonInteraction, matchId: string) => Promise<void>;
  deploymentType?: 'global' | 'guild'; // Track whether command is deployed globally or to a guild
}
