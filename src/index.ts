import { Client, Events, GatewayIntentBits, Interaction, ButtonInteraction } from 'discord.js';
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

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
    return;
  }

  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const commandName = interaction.commandName;
    const command = commands.get(commandName);

    if (!command || !command.autocomplete) {
      console.error(`No autocomplete handler for ${commandName}`);
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Error handling autocomplete for ${commandName}:`, error);
    }
    return;
  }

  // Handle command interactions
  if (!interaction.isChatInputCommand()) return;

  // Log the interaction
  console.log(`Processing interaction: ${interaction.id}, type: ${interaction.type}`);
  
  const commandName = interaction.commandName;
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

// Handle button interactions
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  console.log(`Processing button interaction: ${customId}`);

  // Handle join_league button
  if (customId.startsWith('join_league:')) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const [_, leagueName, targetUserId] = customId.split(':');
      
      // Verify the user clicking is the invited user
      if (interaction.user.id !== targetUserId) {
        await interaction.editReply({ content: 'This invitation is for someone else.' });
        return;
      }
      
      // Add the player to the league
      await db.addPlayerToLeague(interaction, interaction.user.id, leagueName);
      
      // Create success message
      await interaction.editReply({ 
        content: `✅ You've successfully joined **${leagueName}**! Check your status with \`/status\`.`
      });
      
      // Update the original message to show the invitation was accepted
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = {
        ...originalEmbed.data,
        color: 0x00FF00, // Green color
        title: '✅ League Invitation Accepted',
      };
      
      await interaction.message.edit({ 
        embeds: [updatedEmbed],
        components: [] // Remove the button
      });
      
    } catch (error) {
      console.error('Error handling join_league button:', error);
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to join the league' });
      }
    }
    return;
  }
}

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
