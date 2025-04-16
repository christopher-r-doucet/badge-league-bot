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
  const leagues = await db.getLeagues(guildId);
  
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
        const isPlayer1 = match.player1.discordId === userId;
        const opponent = isPlayer1 ? match.player2 : match.player1;
        const opponentName = opponent ? opponent.username : 'Unknown player';
        
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
      const dateString = interaction.options.getString('date');
      const timeString = interaction.options.getString('time');
      
      if (opponent.id === interaction.user.id) {
        return interaction.editReply('You cannot challenge yourself to a match. Please select a different opponent.');
      }
      
      let scheduledDate: Date | undefined = undefined;
      
      // If date is provided, validate and parse date/time
      if (dateString) {
        // Parse date
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
          return interaction.editReply('Invalid date format. Please use YYYY-MM-DD.');
        }
        
        // Parse time if provided
        let timeHours = 12;
        let timeMinutes = 0;
        
        if (timeString) {
          const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
          if (!timeRegex.test(timeString)) {
            return interaction.editReply('Invalid time format. Please use HH:MM (24-hour format).');
          }
          
          const [hours, minutes] = timeString.split(':').map(Number);
          timeHours = hours;
          timeMinutes = minutes;
        }
        
        // Create date object
        scheduledDate = new Date(`${dateString}T${timeHours.toString().padStart(2, '0')}:${timeMinutes.toString().padStart(2, '0')}:00`);
        
        // Validate date is in the future
        if (scheduledDate < new Date()) {
          return interaction.editReply('The scheduled date must be in the future.');
        }
      }
      
      // Schedule the match
      try {
        const guildId = interaction.guildId;
        
        // Ensure the command is used in a guild
        if (!guildId) {
          return interaction.editReply('This command can only be used in a server.');
        }
        
        const match = await db.scheduleMatch(
          leagueName,
          interaction.user.id,
          opponent.id,
          guildId,
          scheduledDate
        );
        
        // For scheduled matches
        const enrichedMatch = await db.getMatch(match.id);
        const dateDisplay = scheduledDate ? formatDate(scheduledDate as Date) : 'Instant match';
        
        // Different handling for instant vs scheduled matches
        if (!scheduledDate) {
          // For instant matches, send a confirmation request to the opponent
          const confirmRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`match_accept:${match.id}`)
                .setLabel('Accept Challenge')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`match_decline:${match.id}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
            );
          
          const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Match Challenge')
            .setDescription(`${interaction.user} has challenged ${opponent} to a match in ${leagueName}!`)
            .addFields(
              { name: 'League', value: leagueName, inline: true },
              { name: 'Type', value: 'Instant Match', inline: true }
            )
            .setFooter({ text: 'This challenge will expire in 24 hours if not accepted.' });
          
          await interaction.editReply({ 
            content: `${opponent}, you've been challenged to a match!`,
            embeds: [embed],
            components: [confirmRow]
          });
        } else {
          // For scheduled matches
          const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Match Scheduled')
            .setDescription(`A match has been scheduled between ${interaction.user} and ${opponent}`)
            .addFields(
              { name: 'League', value: leagueName, inline: true },
              { name: 'Date & Time', value: dateDisplay, inline: true }
            );
          
          await interaction.editReply({ embeds: [embed] });
        }
      } catch (error: any) {
        await interaction.editReply(`Error scheduling match: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in schedule_match command:', error);
      await interaction.editReply('An error occurred while scheduling the match.');
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
        .setDescription('ID of the match')
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
        // Get match details first to determine player positions
        const matchBefore = await db.getMatch(matchId);
        
        if (!matchBefore) {
          return interaction.editReply('Match not found.');
        }
        
        // Check if user is a participant
        const isPlayer1 = matchBefore.player1Id === interaction.user.id;
        const isPlayer2 = matchBefore.player2Id === interaction.user.id;
        
        if (!isPlayer1 && !isPlayer2) {
          return interaction.editReply('You are not a participant in this match.');
        }
        
        // Determine which score belongs to which player
        // Winner gets 1, loser gets 0
        let player1Score, player2Score;
        
        if (isPlayer1) {
          player1Score = didWin ? 1 : 0;
          player2Score = didWin ? 0 : 1;
        } else {
          player1Score = didWin ? 0 : 1;
          player2Score = didWin ? 1 : 0;
        }
        
        // Report the result
        const updatedMatch = await db.reportMatchResult(
          matchId,
          interaction.user.id,
          player1Score,
          player2Score
        );
        
        // Get enriched match with player details
        const enrichedMatch = await db.getMatch(matchId);
        const winner = didWin ? interaction.user : (isPlayer1 ? enrichedMatch.player2 : enrichedMatch.player1);
        const loser = didWin ? (isPlayer1 ? enrichedMatch.player2 : enrichedMatch.player1) : interaction.user;
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Match Result Reported')
          .setDescription(`Match in ${enrichedMatch.league.name} has been completed!`)
          .addFields(
            { name: 'Winner', value: `<@${winner.discordId}>`, inline: true },
            { name: 'Loser', value: `<@${loser.discordId}>`, inline: true },
            { name: 'New ELO', value: `${winner.username}: ${winner.elo}\n${loser.username}: ${loser.elo}`, inline: false }
          );
        
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
      
      try {
        const matches = await db.getScheduledMatches(leagueName);
        
        if (matches.length === 0) {
          return interaction.editReply(`No scheduled matches found in ${leagueName}.`);
        }
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`Scheduled Matches - ${leagueName}`)
          .setDescription('Here are all the scheduled matches:');
        
        // Add fields for each match
        matches.forEach((match, index) => {
          const dateInfo = match.scheduledDate 
            ? `Scheduled for ${formatDate(new Date(match.scheduledDate))}` 
            : 'Instant match (waiting for acceptance)';
          
          const confirmationStatus = match.player1Confirmed && match.player2Confirmed 
            ? '✅ Both players confirmed' 
            : match.player1Confirmed 
              ? '⏳ Waiting for player 2 confirmation' 
              : match.player2Confirmed 
                ? '⏳ Waiting for player 1 confirmation'
                : '⏳ Waiting for both players to confirm';
          
          // Get match status with confirmation details
          let matchStatusDisplay = match.status;
          if (match.status === MatchStatus.SCHEDULED) {
            if (match.player1Confirmed && match.player2Confirmed) {
              matchStatusDisplay = 'Ready to play';
            } else {
              matchStatusDisplay = 'Waiting for acceptance';
            }
          }
          
          const leagueInfo = `League: ${match.league.name}`;
          const opponentId = interaction.user.id === match.player1Id ? match.player2Id : match.player1Id;
          
          embed.addFields({
            name: `Match #${index + 1}`,
            value: `**Players**: <@${match.player1.discordId}> vs <@${match.player2.discordId}>\n**Status**: ${matchStatusDisplay}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
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
        await interaction.editReply('An error occurred while retrieving matches.');
      } else {
        await interaction.reply({ content: 'An error occurred while retrieving matches.', ephemeral: true });
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
      const matches = await db.getPlayerMatches(interaction.user.id, undefined, guildId);
      
      if (matches.length === 0) {
        return interaction.editReply('You have no matches in this server.');
      }
      
      // Filter matches by status
      const scheduledMatches = matches.filter(match => match.status === MatchStatus.SCHEDULED);
      const completedMatches = matches.filter(match => match.status === MatchStatus.COMPLETED);
      
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
          // Determine opponent
          const isPlayer1 = match.player1.discordId === interaction.user.id;
          const opponent = isPlayer1 ? match.player2 : match.player1;
          const opponentName = opponent ? opponent.username : 'Unknown player';

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
          const leagueInfo = `League ID: ${match.leagueId}`;

          embed.addFields({
            name: `Match #${index + 1}`,
            value: `**Opponent**: ${opponentName}\n**Status**: ${matchStatusDisplay}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
            inline: false
          });
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
            // Determine opponent and result
            const isPlayer1 = match.player1.discordId === interaction.user.id;
            const opponent = isPlayer1 ? match.player2 : match.player1;
            const opponentName = opponent ? opponent.username : 'Unknown player';
            const didWin = (isPlayer1 && match.winnerId === match.player1Id) || (!isPlayer1 && match.winnerId === match.player2Id);

            // Format completion date
            const dateInfo = match.completedDate 
              ? formatDate(match.completedDate) 
              : 'Unknown date';

            // Get league name
            const leagueInfo = `League ID: ${match.leagueId}`;

            embed.addFields({
              name: `Match #${index + 1}`,
              value: `**Opponent**: ${opponentName}\n**Result**: ${didWin ? '🏆 Win' : '❌ Loss'}\n**Date**: ${dateInfo}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
              inline: false
            });
          });
      }
      
      // Add action buttons for the first match
      const firstMatch = scheduledMatches[0];
      const actionRow = new ActionRowBuilder<ButtonBuilder>();
      
      // Only add confirm button if the player hasn't confirmed yet
      const isPlayer1 = firstMatch.player1Id === interaction.user.id;
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
    } catch (error: any) {
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
