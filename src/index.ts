import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';
import { db } from './database/index.js';

// Load environment variables only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Log the interaction
  console.log(`Processing interaction: ${interaction.id}, type: ${interaction.type}`);

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const commandName = interaction.commandName;
  
  // In development, handle only dev_ prefixed commands
  // In production, handle only non-prefixed commands
  if (isDevelopment && !commandName.startsWith('dev_')) {
    console.log(`Development bot ignoring production command: ${commandName}`);
    return;
  } else if (!isDevelopment && commandName.startsWith('dev_')) {
    console.log(`Production bot ignoring development command: ${commandName}`);
    return;
  }

  // Look up the command directly by its full name (including dev_ prefix if present)
  console.log(`Looking up command handler for: ${commandName}`);
  const command = commands.get(commandName);

  if (!command) {
    console.error(`No command matching ${commandName} was found.`);
    console.log('Available commands:', Array.from(commands.keys()).join(', '));
    await interaction.reply({ content: 'Unknown command!', ephemeral: true });
    return;
  }

  try {
    // Always defer the reply first
    console.log(`Deferring reply for interaction ${interaction.id}`);
    await interaction.deferReply();

    // Execute the command
    console.log(`Executing command: ${commandName}`);
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${commandName}:`, error);
    
    try {
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else if (!interaction.replied) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
});

// Initialize database and start bot
async function main() {
  try {
    await db.init();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Failed to start the bot:', error);
    process.exit(1);
  }
}

main();
