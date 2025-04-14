import { Collection } from 'discord.js';
import { leagueCommands } from './league.js';
// Create a collection of commands
const commands = new Collection();
// Add all league commands
for (const command of leagueCommands) {
    commands.set(command.data.name, command);
}
export { commands };
