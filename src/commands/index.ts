import { CommandInteraction, SlashCommandBuilder, Collection } from 'discord.js';
import type { Command } from '../types/commands.js';
import { leagueCommands } from './league.js';
import { playerCommands } from './player.js';
import { helpCommands } from './help.js';

// Create a collection of commands
const commands = new Collection<string, Command>();

// Add all commands
const allCommands = [...leagueCommands, ...playerCommands, ...helpCommands];
for (const command of allCommands) {
  commands.set(command.data.name, command);
}

export { commands };
