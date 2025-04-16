import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CommandInteraction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { db } from '../database/index-new-complete.js';
import { MatchStatus } from '../entities/Match.js';
import { formatDate } from '../utils/formatters.js';
import type { Command } from '../types/commands.js';

// Helper function for league name autocomplete
async function handleLeagueAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const guildId = interaction.guildId || undefined;
  
  // Only show leagues for the current guild
  const leagues = await db.getGuildLeagues(guildId);
  
  const filtered = leagues
    .filter((league) => league.name.toLowerCase().includes(focusedValue))
    .slice(0, 25) // Discord has a limit of 25 choices
    .map((league) => ({ name: league.name, value: league.name }));
  await interaction.respond(filtered);
}

// Helper function for match ID autocomplete
async function handleMatchIdAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const userId = interaction.user.id;
  const guildId = interaction.guildId || undefined;
  
  try {
    console.log(`Autocomplete request for match_id from user ${userId} in guild ${guildId || 'DM'}`);
    
    // Get all matches for this user (without status filter to include all matches)
    const matches = await db.getPlayerMatches(userId, undefined, guildId);
    
    console.log(`Retrieved ${matches.length} total matches for user ${userId}`);
    
    // Log details of each match for debugging
    matches.forEach((match, index) => {
      console.log(`Match ${index + 1}: ID=${match.id}, Status=${match.status}, Player1Confirmed=${match.player1Confirmed}, Player2Confirmed=${match.player2Confirmed}`);
    });
    
    // For testing purposes, show all matches regardless of status
    const readyMatches = matches;
    
    console.log(`Using ${readyMatches.length} matches for autocomplete (all matches for testing)`);
    
    // Filter and format matches for autocomplete
    const filtered = readyMatches
      .filter((match) => 
        match.id.toLowerCase().includes(focusedValue)
      )
      .slice(0, 25)
      .map((match) => {
        // Create a descriptive label
        const isPlayer1 = match.player1 && match.player1.discordId === userId;
        const opponent = isPlayer1 ? match.player2 : match.player1;
        const opponentName = opponent && opponent.username ? opponent.username : 'Unknown player';
        
        const matchDate = match.scheduledDate ? 
          new Date(match.scheduledDate).toLocaleDateString() : 
          'Instant match';
        
        // Use a shorter ID format for display
        const shortId = match.id.substring(0, 8);
        
        return {
          name: `Match vs ${opponentName} - ID: ${shortId} (${match.status})`,
          value: match.id
        };
      });
    
    console.log(`Returning ${filtered.length} matches for autocomplete`);
    await interaction.respond(filtered);
  } catch (error) {
    console.error('Error in match ID autocomplete:', error);
    await interaction.respond([]);
  }
}

// Schedule match command
const scheduleMatchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule_match')
    .setDescription('Schedule a Match with another player')
    .addUserOption(option => 
      option.setName('opponent')
        .setDescription('The player you want to challenge')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league for this match')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option => 
      option.setName('date')
        .setDescription('Date of the match (YYYY-MM-DD) - leave empty for instant match')
        .setRequired(false)
    )
    .addStringOption(option => 
      option.setName('time')
        .setDescription('Time of the match (HH:MM) - not needed for instant matches')
        .setRequired(false)
    ) as unknown as SlashCommandBuilder,
  
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'league') {
      await handleLeagueAutocomplete(interaction);
    }
  },
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Don't defer reply here since it's already deferred in index.ts
      
      const opponent = interaction.options.getUser('opponent', true);
      const leagueName = interaction.options.getString('league', true);
      const dateStr = interaction.options.getString('date');
      const timeStr = interaction.options.getString('time');
      const guildId = interaction.guildId;
      
      // Validate that we're in a guild
      if (!guildId) {
        return interaction.editReply('This command can only be used in a server.');
      }
      
      // Check that the opponent is not the same as the player
      if (opponent.id === interaction.user.id) {
        return interaction.editReply('You cannot schedule a match against yourself.');
      }
      
      // Parse date and time if provided
      let matchDate: Date | undefined = undefined;
      
      if (dateStr) {
        // If date is provided, validate it
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return interaction.editReply('Invalid date format. Please use YYYY-MM-DD.');
        }
        
        // If time is also provided, combine them
        if (timeStr) {
          if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
            return interaction.editReply('Invalid time format. Please use HH:MM.');
          }
          
          matchDate = new Date(`${dateStr}T${timeStr}`);
        } else {
          // If only date is provided, use noon as default time
          matchDate = new Date(`${dateStr}T12:00`);
        }
        
        // Validate that the date is in the future
        if (matchDate < new Date()) {
          return interaction.editReply('Match date must be in the future.');
        }
      }
      
      try {
        // Schedule the match
        const match = await db.scheduleMatch(
          leagueName,
          interaction.user.id,
          opponent.id,
          guildId,
          matchDate
        );
        
        // Get the enriched match with player and league details
        const enrichedMatch = await db.getMatch(match.id);
        
        if (!enrichedMatch) {
          return interaction.editReply('Failed to retrieve match details after scheduling.');
        }
        
        // Create confirmation buttons
        const confirmButton = new ButtonBuilder()
          .setCustomId(`match_confirm:${match.id}`)
          .setLabel('Confirm Match')
          .setStyle(ButtonStyle.Success);
        
        const cancelButton = new ButtonBuilder()
          .setCustomId(`match_cancel:${match.id}`)
          .setLabel('Cancel Match')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(confirmButton, cancelButton);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('Match Scheduled')
          .setDescription(`A match has been scheduled between <@${interaction.user.id}> and <@${opponent.id}>.`)
          .addFields(
            { name: 'League', value: enrichedMatch.league?.name || 'Unknown League', inline: true },
            { name: 'Status', value: 'Waiting for confirmation', inline: true },
            { name: 'Match ID', value: match.id.substring(0, 8) + '...', inline: true }
          );
        
        // Add date field if scheduled
        if (matchDate) {
          embed.addFields({ 
            name: 'Scheduled For', 
            value: formatDate(matchDate), 
            inline: false 
          });
        } else {
          embed.addFields({ 
            name: 'Scheduled For', 
            value: 'Instant match (play now)', 
            inline: false 
          });
        }
        
        // Add confirmation status
        embed.addFields({ 
          name: 'Confirmation Status', 
          value: `<@${interaction.user.id}>: ✅ (Scheduler)\n<@${opponent.id}>: ❌ (Waiting)`, 
          inline: false 
        });
        
        await interaction.editReply({ 
          content: `<@${opponent.id}> - You've been challenged to a match!`,
          embeds: [embed], 
          components: [row] 
        });
      } catch (error: any) {
        await interaction.editReply(`Error scheduling match: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in schedule_match command:', error);
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while scheduling the match.');
      } else {
        await interaction.reply({ content: 'An error occurred while scheduling the match.', ephemeral: true });
      }
    }
  }
};

// Report match result command
const reportResultCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('report_result')
    .setDescription('Report the Result of a completed match')
    .addStringOption(option => 
      option.setName('match_id')
        .setDescription('ID of the match to report')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addBooleanOption(option => 
      option.setName('did_you_win')
        .setDescription('Did you win the match?')
        .setRequired(true)
    ) as unknown as SlashCommandBuilder,
  
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'match_id') {
      await handleMatchIdAutocomplete(interaction);
    }
  },
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Don't defer reply here since it's already deferred in index.ts
      
      const matchId = interaction.options.getString('match_id', true);
      const didWin = interaction.options.getBoolean('did_you_win', true);
      
      try {
        // Get match details before updating
        const matchBefore = await db.getMatch(matchId);
        
        if (!matchBefore) {
          return interaction.editReply('Match not found.');
        }
        
        // Check if the user is a participant in the match
        const isPlayer1 = matchBefore.player1?.discordId === interaction.user.id;
        const isPlayer2 = matchBefore.player2?.discordId === interaction.user.id;
        
        if (!isPlayer1 && !isPlayer2) {
          return interaction.editReply('You are not a participant in this match.');
        }
        
        // Determine scores (1 for winner, 0 for loser)
        let player1Score = 0;
        let player2Score = 0;
        
        if ((isPlayer1 && didWin) || (isPlayer2 && !didWin)) {
          player1Score = 1;
          player2Score = 0;
        } else {
          player1Score = 0;
          player2Score = 1;
        }
        
        // Report the result
        await db.reportMatchResult(matchId, interaction.user.id, player1Score, player2Score);
        
        // Get updated match details
        const enrichedMatch = await db.getMatch(matchId);
        
        if (!enrichedMatch) {
          return interaction.editReply('Failed to retrieve match details after reporting result.');
        }
        
        // Determine winner ID based on who reported and if they won
        const winnerId = didWin ? interaction.user.id : 
                        (isPlayer1 ? matchBefore.player2?.discordId : matchBefore.player1?.discordId);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Match Result Reported')
          .setDescription(`The result for match ID \`${matchId.substring(0, 8)}...\` has been recorded.`)
          .addFields(
            { name: 'Winner', value: `<@${winnerId}>`, inline: true },
            { name: 'League', value: enrichedMatch.league?.name || 'Unknown League', inline: true },
            { name: 'Reported By', value: `<@${interaction.user.id}>`, inline: true }
          );
        
        // Add player fields
        if (enrichedMatch.player1 && enrichedMatch.player2) {
          embed.addFields(
            { name: 'Player 1', value: `<@${enrichedMatch.player1.discordId}>`, inline: true },
            { name: 'Player 2', value: `<@${enrichedMatch.player2.discordId}>`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true } // Empty field for alignment
          );
        }
        
        // Add completion date
        if (enrichedMatch.completedDate) {
          embed.addFields({ 
            name: 'Completed', 
            value: formatDate(enrichedMatch.completedDate), 
            inline: false 
          });
        }
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply(`Error reporting match result: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in report_result command:', error);
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while reporting the match result.');
      } else {
        await interaction.reply({ content: 'An error occurred while reporting the match result.', ephemeral: true });
      }
    }
  }
};

// View scheduled matches command
const viewMatchesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('view_matches')
    .setDescription('View All Matches in a league')
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league to view matches for')
        .setRequired(true)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
  
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'league') {
      await handleLeagueAutocomplete(interaction);
    }
  },
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Don't defer reply here since it's already deferred in index.ts
      
      const leagueName = interaction.options.getString('league', true);
      const guildId = interaction.guildId;
      
      // Validate that we're in a guild
      if (!guildId) {
        return interaction.editReply('This command can only be used in a server.');
      }
      
      try {
        // Get league first to validate it exists
        const league = await db.getLeague(leagueName, guildId);
        
        if (!league) {
          return interaction.editReply(`League "${leagueName}" not found.`);
        }
        
        // Get scheduled matches for the league
        const matches = await db.getScheduledMatches(leagueName);
        
        if (matches.length === 0) {
          return interaction.editReply(`No scheduled matches found in league "${leagueName}".`);
        }
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`Scheduled Matches - ${leagueName}`)
          .setDescription(`There are ${matches.length} scheduled matches in this league.`)
          .setTimestamp()
          .setFooter({ text: 'Badge League Bot' });
        
        // Add each match to the embed (up to 10)
        matches.slice(0, 10).forEach((match, index) => {
          const player1Name = match.player1?.username || 'Unknown Player';
          const player2Name = match.player2?.username || 'Unknown Player';
          
          const dateInfo = match.scheduledDate 
            ? formatDate(match.scheduledDate) 
            : 'Instant match (no scheduled date)';
          
          const confirmationStatus = `${match.player1Confirmed ? '✅' : '❌'} vs ${match.player2Confirmed ? '✅' : '❌'}`;
          
          embed.addFields({
            name: `Match #${index + 1}`,
            value: `**Players**: ${player1Name} vs ${player2Name}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**ID**: \`${match.id.substring(0, 8)}...\``,
            inline: false
          });
        });
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply(`Error viewing matches: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in view_matches command:', error);
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while viewing matches.');
      } else {
        await interaction.reply({ content: 'An error occurred while viewing matches.', ephemeral: true });
      }
    }
  }
};

// View my matches command
const myMatchesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('my_matches')
    .setDescription('View My Matches (upcoming and completed)')
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league to view matches for')
        .setRequired(false)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Don't defer reply here since it's already deferred in index.ts
      
      const guildId = interaction.guildId || undefined;
      
      // Get all matches for this user
      const matches = await db.getPlayerMatches(interaction.user.id, undefined, guildId);
      
      if (!matches || matches.length === 0) {
        return interaction.editReply('You have no matches in this server.');
      }
      
      // Filter matches by status
      const scheduledMatches = matches.filter(match => match && match.status === MatchStatus.SCHEDULED);
      const completedMatches = matches.filter(match => match && match.status === MatchStatus.COMPLETED);
      
      if (scheduledMatches.length === 0 && completedMatches.length === 0) {
        return interaction.editReply('You have no matches.');
      }
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Your Matches')
        .setDescription(`You have ${scheduledMatches.length} scheduled and ${completedMatches.length} completed matches.`)
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });
      
      // Add scheduled matches
      if (scheduledMatches.length > 0) {
        embed.addFields({
          name: '📅 Upcoming Matches',
          value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        });
        
        // Add each scheduled match
        scheduledMatches.forEach((match, index) => {
          try {
            if (!match) return; // Skip if match is undefined
            
            // Safely determine opponent
            const isPlayer1 = match.player1 && match.player1.discordId === interaction.user.id;
            const opponent = isPlayer1 ? match.player2 : match.player1;
            const opponentName = opponent && opponent.username ? opponent.username : 'Unknown player';

            // Format date
            const dateInfo = match.scheduledDate 
              ? formatDate(match.scheduledDate) 
              : 'Instant match (no scheduled date)';
            
            // Confirmation status
            const player1Confirmed = match.player1Confirmed ? '✅' : '❌';
            const player2Confirmed = match.player2Confirmed ? '✅' : '❌';
            const confirmationStatus = `You: ${isPlayer1 ? player1Confirmed : player2Confirmed} | Opponent: ${isPlayer1 ? player2Confirmed : player1Confirmed}`;

            // Get match status with confirmation details
            let matchStatusDisplay = match.status;
            if (match.status === MatchStatus.SCHEDULED) {
              if (match.player1Confirmed && match.player2Confirmed) {
                matchStatusDisplay = 'Ready to play';
              } else {
                matchStatusDisplay = 'Waiting for acceptance';
              }
            }

            // Get league name
            const leagueInfo = match.league ? `League: ${match.league.name}` : `League ID: ${match.leagueId}`;

            embed.addFields({
              name: `Match #${index + 1}`,
              value: `**Opponent**: ${opponentName}\n**Status**: ${matchStatusDisplay}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
              inline: false
            });
          } catch (error) {
            console.error(`Error processing match:`, error);
            // Skip this match if there's an error
          }
        });
      }
      
      // Add completed matches
      if (completedMatches.length > 0) {
        embed.addFields({
          name: '🏆 Completed Matches',
          value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        });
        
        // Add each completed match (up to 5 most recent)
        completedMatches
          .sort((a, b) => new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime())
          .slice(0, 5)
          .forEach((match, index) => {
            try {
              if (!match) return; // Skip if match is undefined
              
              // Safely determine opponent and result
              const isPlayer1 = match.player1 && match.player1.discordId === interaction.user.id;
              const opponent = isPlayer1 ? match.player2 : match.player1;
              const opponentName = opponent && opponent.username ? opponent.username : 'Unknown player';
              const didWin = (isPlayer1 && match.winnerId === match.player1Id) || (!isPlayer1 && match.winnerId === match.player2Id);

              // Format completion date
              const dateInfo = match.completedDate 
                ? formatDate(match.completedDate) 
                : 'Unknown date';

              // Get league name
              const leagueInfo = match.league ? `League: ${match.league.name}` : `League ID: ${match.leagueId}`;

              embed.addFields({
                name: `Match #${index + 1}`,
                value: `**Opponent**: ${opponentName}\n**Result**: ${didWin ? '🏆 Win' : '❌ Loss'}\n**Date**: ${dateInfo}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
                inline: false
              });
            } catch (error) {
              console.error(`Error processing completed match:`, error);
              // Skip this match if there's an error
            }
          });
      }
      
      // Add action buttons for the first match
      if (scheduledMatches.length > 0) {
        const firstMatch = scheduledMatches[0];
        
        if (firstMatch) { // Check if firstMatch exists
          const actionRow = new ActionRowBuilder<ButtonBuilder>();
          
          // Only add confirm button if the player hasn't confirmed yet
          const isPlayer1 = firstMatch.player1 && firstMatch.player1.discordId === interaction.user.id;
          const hasConfirmed = isPlayer1 ? firstMatch.player1Confirmed : firstMatch.player2Confirmed;
          
          if (!hasConfirmed) {
            actionRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`match_confirm:${firstMatch.id}`)
                .setLabel('Confirm Match')
                .setStyle(ButtonStyle.Success)
            );
          }
          
          // Add report and cancel buttons
          actionRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`match_report:${firstMatch.id}`)
              .setLabel('Report Result')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`match_cancel:${firstMatch.id}`)
              .setLabel('Cancel Match')
              .setStyle(ButtonStyle.Danger)
          );
          
          // Only add components if we have any buttons
          const replyOptions: any = { embeds: [embed] };
          if (actionRow.components.length > 0) {
            replyOptions.components = [actionRow];
          }
          
          await interaction.editReply(replyOptions);
        } else {
          await interaction.editReply({ embeds: [embed] });
        }
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error: any) {
      console.error('Error in my_matches command:', error);
      await interaction.editReply(`Error viewing your matches: ${error.message}`);
    }
  }
};

// Cancel match command
const cancelMatchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cancel_match')
    .setDescription('Cancel a Match you scheduled')
    .addStringOption(option => 
      option.setName('match_id')
        .setDescription('ID of the match to cancel')
        .setRequired(true)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
  
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'match_id') {
      await handleMatchIdAutocomplete(interaction);
    }
  },
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Don't defer reply here since it's already deferred in index.ts
      
      const matchId = interaction.options.getString('match_id', true);
      
      try {
        const match = await db.cancelMatch(matchId, interaction.user.id);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Match Cancelled')
          .setDescription(`The match has been cancelled.`)
          .addFields(
            { name: 'Players', value: `<@${match.player1Id}> vs <@${match.player2Id}>`, inline: false },
            { name: 'Cancelled by', value: `<@${interaction.user.id}>`, inline: false }
          );
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply(`Error cancelling match: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in cancel_match command:', error);
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while cancelling the match.');
      } else {
        await interaction.reply({ content: 'An error occurred while cancelling the match.', ephemeral: true });
      }
    }
  }
};

export const matchCommands = [
  scheduleMatchCommand,
  reportResultCommand,
  viewMatchesCommand,
  myMatchesCommand,
  cancelMatchCommand
];
