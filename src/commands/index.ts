import { CommandInteraction, SlashCommandBuilder, Collection } from 'discord.js';
import type { Command } from '../types/commands.js';
import { leagueCommands } from './league.js';

// Create a collection of commands
const commands = new Collection<string, Command>();

// Add all league commands
for (const command of leagueCommands) {
    commands.set(command.data.name, command);
}

export { commands };
