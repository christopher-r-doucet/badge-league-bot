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
const isDevelopment = process.env.NODE_ENV !== 'production';

async function listRegisteredCommands() {
    try {
        console.log('Fetching registered commands...');

        // Get global commands
        console.log('\nProduction (Global) commands:');
        const globalCommands = await rest.get(
            Routes.applicationCommands(process.env.CLIENT_ID!)
        ) as any[];
        console.log(`Found ${globalCommands.length} global commands:`);
        globalCommands.forEach(cmd => console.log(`- ${cmd.name} (ID: ${cmd.id})`));

        // Get guild commands
        console.log('\nDevelopment (Guild) commands:');
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
        console.log(`Started refreshing ${isDevelopment ? 'development' : 'production'} commands...`);

        // Get command data and prefix dev commands if in development
        const commandData = Array.from(commands.values()).map(command => {
            const data = command.data.toJSON();
            if (isDevelopment) {
                // Add dev_ prefix to command name
                data.name = `dev_${data.name}`;
                // Add [DEV] to command description
                data.description = `[DEV] ${data.description}`;
            }
            return data;
        });

        if (isDevelopment) {
            // Development: Use guild-specific commands with dev_ prefix
            console.log('Registering development commands for guild...');
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
                { body: commandData }
            );
            console.log('Successfully registered development commands:', 
                commandData.map(cmd => cmd.name).join(', '));
        } else {
            // Production: Use global commands without prefix
            console.log('Registering production commands globally...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID!),
                { body: commandData }
            );
            console.log('Successfully registered production commands:', 
                commandData.map(cmd => cmd.name).join(', '));
        }

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
