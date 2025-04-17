import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CommandInteraction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { db } from '../database/index.js';
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
    // Get all matches for this user
    const matches = await db.getPlayerMatches(userId, undefined, guildId);
    // Only show matches that are not completed or cancelled
    const filtered = matches
      .filter(match => match && match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED)
      .filter(match => match.id && match.id.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map(match => {
        const opponentName = match.opponentUsername || 'Unknown player';
        const shortId = match.id.substring(0, 8);
        const leagueName = match.league?.name || 'Unknown league';
        const dateInfo = match.scheduledDate 
          ? formatDate(match.scheduledDate).split(' ')[0] // Just get the date part
          : 'Instant';
        return {
          name: `${leagueName}: vs ${opponentName} - ${dateInfo} (ID: ${shortId})`,
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
    .setName('schedule_match_guild')
    .setDescription('Schedule a Match with another player [Guild]')
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
  deploymentType: 'global',
  
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
        return interaction.editReply({ content: '❌ This command can only be used in a server.' });
      }
      
      // Check that the opponent is not the same as the player
      if (opponent.id === interaction.user.id) {
        return interaction.editReply({ content: '❌ You cannot schedule a match against yourself.' });
      }
      
      // Check if the opponent is a bot
      if (opponent.bot) {
        return interaction.editReply({ content: '❌ You cannot schedule a match against a bot.' });
      }
      
      // Check if the user already has 5 active matches
      const userMatches = await db.getPlayerMatches(interaction.user.id, MatchStatus.SCHEDULED, guildId);
      if (userMatches.length >= 5) {
        return interaction.editReply({ 
          content: '❌ You already have 5 active matches. Please complete or cancel some of your existing matches before scheduling a new one.' 
        });
      }
      
      try {
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
    .setName('report_result_guild')
    .setDescription('Report the Result of a completed match [Guild]')
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
  deploymentType: 'global',
  
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
        // Get match details before reporting
        const matchBefore = await db.getMatch(matchId);
        if (!matchBefore) {
          return interaction.editReply('Match not found.');
        }
        
        // Get opponent details
        const opponentId = matchBefore.player1Id === interaction.user.id ? matchBefore.player2Id : matchBefore.player1Id;
        const opponentName = matchBefore.player1Id === interaction.user.id 
          ? (matchBefore.player2?.username || 'Unknown player')
          : (matchBefore.player1?.username || 'Unknown player');
        
        // Determine scores (1 for winner, 0 for loser)
        let player1Score = 0;
        let player2Score = 0;
        
        const isPlayer1 = matchBefore.player1Id === interaction.user.id;
        
        console.log('Player identification debug:');
        console.log(`matchBefore.player1Id: ${matchBefore.player1Id}`);
        console.log(`matchBefore.player2Id: ${matchBefore.player2Id}`);
        console.log(`interaction.user.id: ${interaction.user.id}`);
        console.log(`isPlayer1: ${isPlayer1}`);
        
        if ((isPlayer1 && didWin) || (!isPlayer1 && !didWin)) {
          // If user is player1 and won, or user is player2 and reported that they lost (meaning player1 won)
          player1Score = 1;
          player2Score = 0;
        } else {
          // If user is player1 and lost, or user is player2 and reported that they won (meaning player1 lost)
          player1Score = 0;
          player2Score = 1;
        }
        
        console.log('Match command debug:');
        console.log(`User: ${interaction.user.username}, ID: ${interaction.user.id}`);
        console.log(`isPlayer1: ${isPlayer1}, didWin: ${didWin}`);
        console.log(`player1Score: ${player1Score}, player2Score: ${player2Score}`);
        
        // Report the match result
        const match = await db.reportMatchResult(matchId, interaction.user.id, player1Score, player2Score);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Match Result Reported')
          .setDescription(`The result for match in **${matchBefore.league?.name || 'Unknown League'}** has been reported.`)
          .addFields(
            { 
              name: 'Players', 
              value: `${matchBefore.player1?.username || 'Unknown player'} vs ${matchBefore.player2?.username || 'Unknown player'}`, 
              inline: false 
            },
            { 
              name: 'Winner', 
              value: match.winnerId === matchBefore.player1Id 
                ? matchBefore.player1?.username || 'Unknown player'
                : matchBefore.player2?.username || 'Unknown player', 
              inline: true 
            },
            { 
              name: 'Reported By', 
              value: interaction.user.username, 
              inline: true 
            }
          );
        
        // Add ELO changes if available
        if (match.player1EloChange !== undefined && match.player2EloChange !== undefined) {
          const player1Name = matchBefore.player1?.username || 'Player 1';
          const player2Name = matchBefore.player2?.username || 'Player 2';
          
          // Get the actual ELO values after the match
          const player1EloNew = match.player1EloBefore + match.player1EloChange;
          const player2EloNew = match.player2EloBefore + match.player2EloChange;
          
          // Format ELO changes with correct signs and emojis
          const player1IsWinner = match.winnerId === matchBefore.player1Id;
          const player1ChangeText = player1IsWinner
            ? `📈 ${player1Name}: ${player1EloNew}(+${Math.abs(match.player1EloChange)})` 
            : `📉 ${player1Name}: ${player1EloNew}(${match.player1EloChange})`;
            
          const player2IsWinner = match.winnerId === matchBefore.player2Id;
          const player2ChangeText = player2IsWinner
            ? `📈 ${player2Name}: ${player2EloNew}(+${Math.abs(match.player2EloChange)})` 
            : `📉 ${player2Name}: ${player2EloNew}(${match.player2EloChange})`;
          
          embed.addFields({
            name: 'New ELO',
            value: `${player1ChangeText}\n${player2ChangeText}`,
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
    .setName('view_matches_guild')
    .setDescription('View All Matches in a league [Guild]')
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league to view matches for')
        .setRequired(true)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
  deploymentType: 'global',
  
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

// Cancel match command
const cancelMatchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cancel_match_guild')
    .setDescription('Cancel a Match you scheduled [Guild]')
    .addStringOption(option => 
      option.setName('match_id')
        .setDescription('ID of the match to cancel')
        .setRequired(true)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
  deploymentType: 'global',
  
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
  cancelMatchCommand
];
