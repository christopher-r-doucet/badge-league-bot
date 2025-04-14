import { CommandInteraction, SlashCommandBuilder, Collection } from 'discord.js';
import type { Command } from '../types/commands.js';
import { leagueCommands } from './league.js';
import { playerCommands } from './player.js';

// Create a collection of commands
const commands = new Collection<string, Command>();

const isDevelopment = process.env.NODE_ENV !== 'production';

// Add all commands
const allCommands = [...leagueCommands, ...playerCommands];
for (const command of allCommands) {
    const commandName = isDevelopment ? `dev_${command.data.name}` : command.data.name;
    commands.set(commandName, command);
}

export { commands };
