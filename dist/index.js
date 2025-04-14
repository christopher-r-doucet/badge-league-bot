import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';
import { db } from './database/index.js';
// Load environment variables
config({ path: '.env.local' });
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});
// Initialize database when client is ready
client.once('ready', async () => {
    try {
        await db.init();
        console.log('Database initialized');
        console.log('Ready! Logged in');
        // Register commands
        if (!client.application)
            return;
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        const commandData = [...commands.values()].map(command => command.data.toJSON());
        console.log('Started refreshing application (/) commands.');
        console.log('Commands to register:', JSON.stringify(commandData, null, 2));
        try {
            await rest.put(Routes.applicationCommands(client.application.id), { body: commandData });
            console.log('Successfully reloaded application (/) commands.');
        }
        catch (error) {
            console.error('Error refreshing commands:', error);
        }
    }
    catch (error) {
        console.error('Error during initialization:', error);
    }
});
// Handle commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const command = commands.get(interaction.commandName);
    if (!command) {
        console.error(`Command ${interaction.commandName} not found`);
        if (!interaction.replied) {
            await interaction.reply({
                content: 'Unknown command!',
                ephemeral: true
            });
        }
        return;
    }
    try {
        console.log(`Executing command: ${interaction.commandName}`);
        console.log('Command options:', JSON.stringify(interaction.options.data, null, 2));
        await command.execute(interaction);
    }
    catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        // Don't try to reply if we've already replied or deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        try {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        }
        catch (replyError) {
            console.error('Error sending error response:', replyError);
        }
    }
});
// Handle errors
client.on('error', error => {
    console.error('Discord client error:', error);
});
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
// Login
client.login(process.env.DISCORD_TOKEN);
