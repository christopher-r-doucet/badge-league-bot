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
    console.log(`Processing button interaction: ${interaction.customId}`);
    const customId = interaction.customId;
    
    try {
      // Handle match-related buttons
      if (customId.startsWith('match_accept:')) {
        const [_, matchId] = customId.split(':');
        await handleMatchAccept(interaction, matchId);
        return;
      }
      
      if (customId.startsWith('match_decline:')) {
        const [_, matchId] = customId.split(':');
        await handleMatchDecline(interaction, matchId);
        return;
      }
      
      if (customId.startsWith('match_confirm:')) {
        const [_, matchId] = customId.split(':');
        await handleMatchConfirm(interaction, matchId);
        return;
      }
      
      if (customId.startsWith('match_report:')) {
        const [_, matchId] = customId.split(':');
        await handleMatchReport(interaction, matchId);
        return;
      }
      
      if (customId.startsWith('match_cancel:')) {
        const [_, matchId] = customId.split(':');
        await handleMatchCancel(interaction, matchId);
        return;
      }
      
      // Handle league join buttons
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
            components: [] // Remove buttons
          });
        } catch (error) {
          console.error('Error handling league join:', error);
          await interaction.editReply({ content: 'There was an error joining the league. Please try again later.' });
        }
        return;
      }
      
      // If we get here, it's an unknown button type
      await interaction.reply({ content: 'Unknown button action', ephemeral: true });
    } catch (error) {
      console.error(`Error handling button interaction: ${error}`);
      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: 'An error occurred while processing the button' });
        } else {
          await interaction.reply({ content: 'An error occurred while processing the button', ephemeral: true });
        }
      } catch (replyError) {
        console.error('Error sending error response:', replyError);
      }
    }
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
