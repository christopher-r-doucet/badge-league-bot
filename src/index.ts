import { Client, Events, GatewayIntentBits, Interaction, ButtonInteraction, ButtonStyle, ButtonBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';
import { db } from './database/index.js';
import { formatDate } from './utils/formatters.js';

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
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, id] = interaction.customId.split(':');

  try {
    switch (action) {
      case 'match_accept':
        await handleMatchAccept(interaction, id);
        break;
      case 'match_decline':
        await handleMatchDecline(interaction, id);
        break;
      case 'match_confirm':
        await handleMatchConfirm(interaction, id);
        break;
      case 'match_report':
        await handleMatchReport(interaction, id);
        break;
      case 'match_cancel':
        await handleMatchCancel(interaction, id);
        break;
      default:
        await interaction.reply({ content: 'Unknown button action', ephemeral: true });
    }
  } catch (error) {
    console.error(`Error handling button interaction: ${error}`);
    await interaction.reply({ content: 'An error occurred while processing the button', ephemeral: true });
  }
});

// Match button handlers
async function handleMatchAccept(interaction: ButtonInteraction, matchId: string) {
  try {
    await interaction.deferReply();
    const match = await db.confirmMatch(matchId, interaction.user.id);
    const enrichedMatch = await db.getMatch(matchId);
    
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('Match Accepted')
      .setDescription(`${interaction.user} has accepted the match challenge!`)
      .addFields(
        { name: 'League', value: enrichedMatch.league.name, inline: true },
        { name: 'Players', value: `<@${enrichedMatch.player1.discordId}> vs <@${enrichedMatch.player2.discordId}>`, inline: true },
        { name: 'Status', value: 'Ready to play!', inline: true }
      );
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply(`Error accepting match: ${error.message}`);
  }
}

async function handleMatchDecline(interaction: ButtonInteraction, matchId: string) {
  try {
    await interaction.deferReply();
    const match = await db.cancelMatch(matchId, interaction.user.id);
    const enrichedMatch = await db.getMatch(matchId);
    
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Match Declined')
      .setDescription(`${interaction.user} has declined the match challenge.`)
      .addFields(
        { name: 'League', value: enrichedMatch.league.name, inline: true },
        { name: 'Challenger', value: `<@${enrichedMatch.player1.discordId}>`, inline: true }
      );
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply(`Error declining match: ${error.message}`);
  }
}

async function handleMatchConfirm(interaction: ButtonInteraction, matchId: string) {
  try {
    await interaction.deferReply();
    const match = await db.confirmMatch(matchId, interaction.user.id);
    const enrichedMatch = await db.getMatch(matchId);
    
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('Match Confirmed')
      .setDescription(`${interaction.user} has confirmed the match!`)
      .addFields(
        { name: 'League', value: enrichedMatch.league.name, inline: true },
        { name: 'Players', value: `<@${enrichedMatch.player1.discordId}> vs <@${enrichedMatch.player2.discordId}>`, inline: true },
        { name: 'Status', value: 'Ready to play!', inline: true }
      );
    
    if (enrichedMatch.scheduledDate) {
      embed.addFields({ 
        name: 'Scheduled For', 
        value: formatDate(new Date(enrichedMatch.scheduledDate)), 
        inline: true 
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply(`Error confirming match: ${error.message}`);
  }
}

async function handleMatchReport(interaction: ButtonInteraction, matchId: string) {
  try {
    // Create a modal for score reporting
    const modal = new ModalBuilder()
      .setCustomId(`report_match:${matchId}`)
      .setTitle('Report Match Result');
    
    // Add input fields for scores
    const yourScoreInput = new TextInputBuilder()
      .setCustomId('your_score')
      .setLabel('Your Score')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your score')
      .setRequired(true);
    
    const opponentScoreInput = new TextInputBuilder()
      .setCustomId('opponent_score')
      .setLabel('Opponent Score')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter opponent score')
      .setRequired(true);
    
    // Add inputs to action rows
    const yourScoreRow = new ActionRowBuilder<TextInputBuilder>().addComponents(yourScoreInput);
    const opponentScoreRow = new ActionRowBuilder<TextInputBuilder>().addComponents(opponentScoreInput);
    
    // Add action rows to modal
    modal.addComponents(yourScoreRow, opponentScoreRow);
    
    // Show the modal
    await interaction.showModal(modal);
  } catch (error: any) {
    console.error(`Error showing report modal: ${error}`);
    await interaction.reply({ content: 'An error occurred while preparing the report form', ephemeral: true });
  }
}

async function handleMatchCancel(interaction: ButtonInteraction, matchId: string) {
  try {
    await interaction.deferReply();
    const match = await db.cancelMatch(matchId, interaction.user.id);
    const enrichedMatch = await db.getMatch(matchId);
    
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Match Cancelled')
      .setDescription(`${interaction.user} has cancelled the match.`)
      .addFields(
        { name: 'League', value: enrichedMatch.league.name, inline: true },
        { name: 'Players', value: `<@${enrichedMatch.player1.discordId}> vs <@${enrichedMatch.player2.discordId}>`, inline: true }
      );
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply(`Error cancelling match: ${error.message}`);
  }
}

// Handle modal submissions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  const [action, id] = interaction.customId.split(':');
  
  if (action === 'report_match') {
    try {
      await interaction.deferReply();
      
      const yourScore = parseInt(interaction.fields.getTextInputValue('your_score'));
      const opponentScore = parseInt(interaction.fields.getTextInputValue('opponent_score'));
      
      if (isNaN(yourScore) || isNaN(opponentScore) || yourScore < 0 || opponentScore < 0) {
        return interaction.editReply('Invalid scores. Please enter positive numbers only.');
      }
      
      if (yourScore === opponentScore) {
        return interaction.editReply('Scores cannot be equal. There must be a winner.');
      }
      
      // Get match details first to determine player positions
      const matchBefore = await db.getMatch(id);
      
      if (!matchBefore) {
        return interaction.editReply('Match not found.');
      }
      
      // Check if user is a participant
      const isPlayer1 = matchBefore.player1.discordId === interaction.user.id;
      const isPlayer2 = matchBefore.player2.discordId === interaction.user.id;
      
      if (!isPlayer1 && !isPlayer2) {
        return interaction.editReply('You are not a participant in this match.');
      }
      
      // Determine which score belongs to which player
      let player1Score, player2Score;
      
      if (isPlayer1) {
        player1Score = yourScore;
        player2Score = opponentScore;
      } else {
        player1Score = opponentScore;
        player2Score = yourScore;
      }
      
      // Report the result
      const updatedMatch = await db.reportMatchResult(
        id,
        interaction.user.id,
        player1Score,
        player2Score
      );
      
      // Get enriched match with player details
      const enrichedMatch = await db.getMatch(id);
      const winner = player1Score > player2Score ? enrichedMatch.player1 : enrichedMatch.player2;
      const loser = player1Score > player2Score ? enrichedMatch.player2 : enrichedMatch.player1;
      const winnerScore = player1Score > player2Score ? player1Score : player2Score;
      const loserScore = player1Score > player2Score ? player2Score : player1Score;
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Match Result Reported')
        .setDescription(`Match in ${enrichedMatch.league.name} has been completed!`)
        .addFields(
          { name: 'Winner', value: `<@${winner.discordId}> (${winnerScore})`, inline: true },
          { name: 'Loser', value: `<@${loser.discordId}> (${loserScore})`, inline: true },
          { name: 'New ELO', value: `${winner.username}: ${winner.elo} (+${winnerScore - loserScore})\n${loser.username}: ${loser.elo} (-${winnerScore - loserScore})`, inline: false }
        );
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(`Error handling match report: ${error}`);
      await interaction.editReply('An error occurred while reporting the match result.');
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
      await db.addPlayerToLeague(interaction.user.id, interaction.user.username, leagueName);
      
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

  // Handle accept_match button
  if (customId.startsWith('accept_match:')) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const [_, matchId] = customId.split(':');
      
      // Confirm the match
      const match = await db.confirmMatch(matchId, interaction.user.id);
      
      // Create success message
      await interaction.editReply({ 
        content: `✅ You've accepted the match! Good luck!`
      });
      
      // Update the original message
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = {
        ...originalEmbed.data,
        fields: originalEmbed.data.fields?.map(field => {
          if (field.name === 'Status') {
            return {
              ...field,
              value: 'Match accepted! Both players ready to play.'
            };
          }
          return field;
        })
      };
      
      // Remove the accept button but keep the cancel button
      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_match:${matchId}`)
        .setLabel('Cancel Match')
        .setStyle(ButtonStyle.Danger);
      
      const reportButton = new ButtonBuilder()
        .setCustomId(`report_match:${matchId}`)
        .setLabel('Report Result')
        .setStyle(ButtonStyle.Primary);
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(reportButton, cancelButton);
      
      await interaction.message.edit({ 
        embeds: [updatedEmbed],
        components: [row]
      });
      
    } catch (error) {
      console.error('Error handling accept_match button:', error);
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to accept the match' });
      }
    }
    return;
  }

  // Handle cancel_match button
  if (customId.startsWith('cancel_match:')) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const [_, matchId] = customId.split(':');
      
      // Cancel the match
      await db.cancelMatch(matchId, interaction.user.id);
      
      // Create success message
      await interaction.editReply({ 
        content: `✅ You've cancelled the match.`
      });
      
      // Update the original message
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = {
        ...originalEmbed.data,
        color: 0xFF0000, // Red color
        title: '❌ Match Cancelled',
      };
      
      await interaction.message.edit({ 
        embeds: [updatedEmbed],
        components: [] // Remove all buttons
      });
      
    } catch (error) {
      console.error('Error handling cancel_match button:', error);
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to cancel the match' });
      }
    }
    return;
  }

  // Handle report_match button
  if (customId.startsWith('report_match:')) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const [_, matchId] = customId.split(':');
      
      // Create a message with instructions to use the /report_result command
      await interaction.editReply({ 
        content: `To report the match result, please use the \`/report_result\` command with the following ID: \`${matchId}\``
      });
      
    } catch (error) {
      console.error('Error handling report_match button:', error);
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to process report request' });
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
