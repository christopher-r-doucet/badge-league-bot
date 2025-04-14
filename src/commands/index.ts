import { CommandInteraction, SlashCommandBuilder, Collection } from 'discord.js';
import type { Command } from '../types/commands.js';
import { leagueCommands } from './league.js';
import { matchCommands } from './match.js';

// Create a collection of commands
const commands = new Collection<string, Command>();

// Add all league commands
for (const command of leagueCommands) {
    commands.set(command.data.name, command);
}

// Add all match commands
for (const command of matchCommands) {
    commands.set(command.data.name, command);
}

export { commands };
