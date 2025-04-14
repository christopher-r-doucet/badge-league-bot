import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
    config({ path: '.env.local' });
}

// Ensure required environment variables are set
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.error('Required environment variables are missing. Please check your .env.local file.');
    process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function listRegisteredCommands() {
    try {
        console.log('Fetching registered commands...');

        // Get guild commands
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!)
        ) as any[];
        console.log(`Found ${guildCommands.length} guild commands:`);
        guildCommands.forEach(cmd => console.log(`- ${cmd.name} (ID: ${cmd.id})`));

    } catch (error) {
        console.error('Error listing commands:', error);
        if (error instanceof Error) {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

async function deployCommands() {
    try {
        console.log('Started refreshing commands...');

        // Get command data
        const commandData = Array.from(commands.values()).map(command => command.data.toJSON());

        // Register commands to guild
        console.log('Registering commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
            { body: commandData }
        );
        console.log('Successfully registered commands:', 
            commandData.map(cmd => cmd.name).join(', '));

        // List all registered commands to verify
        await listRegisteredCommands();
    } catch (error) {
        console.error('Error deploying commands:', error);
        if (error instanceof Error) {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

// If first argument is "list", only list commands, otherwise deploy
if (process.argv[2] === 'list') {
    listRegisteredCommands();
} else {
    deployCommands();
}
