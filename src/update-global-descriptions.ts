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

async function updateGlobalCommandDescriptions() {
    try {
        console.log('Updating global command descriptions...');

        // Get command data and update descriptions
        const commandData = Array.from(commands.values()).map(command => {
            const commandJson = command.data.toJSON();
            
            // Add [Global] tag to description if it doesn't already have it
            if (!commandJson.description.includes('[Global]')) {
                commandJson.description = `${commandJson.description} [Global]`;
            }
            
            // Set deployment type to global
            command.deploymentType = 'global';
            
            return commandJson;
        });

        // Register commands globally with updated descriptions
        console.log('Registering global commands with updated descriptions...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commandData }
        );
        
        console.log('Successfully updated global command descriptions:', 
            commandData.map(cmd => `${cmd.name}: "${cmd.description}"`).join('\n'));
        
    } catch (error) {
        console.error('Error updating global command descriptions:', error);
        if (error instanceof Error) {
            console.error('Error details:', error);
        }
        process.exit(1);
    }
}

// Run the update
updateGlobalCommandDescriptions();
