import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { leagueCommands } from './league.js';

export interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

// Combine all commands
export const commands: Command[] = [
  ...leagueCommands
];
