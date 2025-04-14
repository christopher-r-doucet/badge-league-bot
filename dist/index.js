import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';
import { db } from './database/index.js';
// Load environment variables
config({ path: '.env.local' });
// Create client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});
// When the client is ready, run this code (only once)
client.once(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    // Initialize database
    await db.init();
    // Register slash commands
    const rest = client.rest;
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(`/applications/${client.user?.id}/commands`, { body: commands.map(command => command.data.toJSON()) });
        console.log('Successfully reloaded application (/) commands.');
    }
    catch (error) {
        console.error(error);
    }
});
// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand())
        return;
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true
        });
    }
});
// Log in to Discord with your client's token
const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error('No token found in environment variables');
}
client.login(token);
