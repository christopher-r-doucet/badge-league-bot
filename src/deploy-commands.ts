import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
    config({ path: '.env.local' });
}

// Ensure required environment variables are set
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('Required environment variables are missing. Please check your .env.local file.');
    process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function listRegisteredCommands(isGlobal = false) {
    try {
        console.log('Fetching registered commands...');

        if (isGlobal) {
            // Get global commands
            const globalCommands = await rest.get(
                Routes.applicationCommands(process.env.CLIENT_ID!)
            ) as any[];
            console.log(`Found ${globalCommands.length} global commands:`);
            globalCommands.forEach(cmd => console.log(`- ${cmd.name} (ID: ${cmd.id})`));
            return globalCommands;
        } else if (process.env.GUILD_ID) {
            // Get guild commands
            const guildCommands = await rest.get(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID)
            ) as any[];
            console.log(`Found ${guildCommands.length} guild commands:`);
            guildCommands.forEach(cmd => console.log(`- ${cmd.name} (ID: ${cmd.id})`));
            return guildCommands;
        } else {
            console.error('GUILD_ID is required for listing guild commands');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error listing commands:', error);
        if (error instanceof Error) {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

async function cleanupCommands(isGlobal = false) {
    try {
        console.log(`Cleaning up existing ${isGlobal ? 'global' : 'guild'} commands...`);
        
        // Get existing commands
        const existingCommands = await listRegisteredCommands(isGlobal) as any[];
        
        // Delete each command
        for (const cmd of existingCommands) {
            console.log(`Deleting command: ${cmd.name} (ID: ${cmd.id})`);
            
            if (isGlobal) {
                await rest.delete(
                    Routes.applicationCommand(process.env.CLIENT_ID!, cmd.id)
                );
            } else if (process.env.GUILD_ID) {
                await rest.delete(
                    Routes.applicationGuildCommand(process.env.CLIENT_ID!, process.env.GUILD_ID, cmd.id)
                );
            }
        }
        
        console.log(`Successfully deleted ${existingCommands.length} commands`);
    } catch (error) {
        console.error('Error cleaning up commands:', error);
        if (error instanceof Error) {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

async function deployCommands(isGlobal = false, cleanup = false) {
    try {
        console.log(`Started refreshing ${isGlobal ? 'global' : 'guild'} commands...`);

        // Clean up existing commands if requested
        if (cleanup) {
            await cleanupCommands(isGlobal);
        }

        // Get command data
        const commandData = Array.from(commands.values()).map(command => command.data.toJSON());

        if (isGlobal) {
            // Register commands globally
            console.log('Registering global commands...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID!),
                { body: commandData }
            );
            console.log('Successfully registered global commands:', 
                commandData.map(cmd => cmd.name).join(', '));
        } else if (process.env.GUILD_ID) {
            // Register commands to guild
            console.log('Registering guild commands...');
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
                { body: commandData }
            );
            console.log('Successfully registered guild commands:', 
                commandData.map(cmd => cmd.name).join(', '));
        } else {
            console.error('GUILD_ID is required for guild commands');
            process.exit(1);
        }

        // List all registered commands to verify
        await listRegisteredCommands(isGlobal);
    } catch (error) {
        console.error('Error deploying commands:', error);
        if (error instanceof Error) {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isGlobal = args.includes('--global');
const listOnly = args.includes('list');
const cleanup = args.includes('--cleanup');

// If first argument is "list", only list commands, otherwise deploy
if (listOnly) {
    listRegisteredCommands(isGlobal);
} else if (args.includes('--clean-only')) {
    cleanupCommands(isGlobal);
} else {
    deployCommands(isGlobal, cleanup);
}
