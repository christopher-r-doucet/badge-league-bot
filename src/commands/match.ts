import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CommandInteraction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { db } from '../database/index.js';
import { MatchStatus } from '../entities/Match.js';
import { formatDate } from '../utils/formatters.js';
import type { Command } from '../types/commands.js';

// Helper function for league name autocomplete
async function handleLeagueAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const leagues = await db.getLeagues();
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
  
  try {
    // Get all matches for this user using the getPlayerMatches method instead
    const matches = await db.getPlayerMatches(userId, MatchStatus.SCHEDULED);
    
    // Filter and format matches for autocomplete
    const filtered = matches
      .filter((match) => 
        match.id.toLowerCase().includes(focusedValue) || 
        match.status === MatchStatus.SCHEDULED // Only show scheduled matches
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
          name: `Match vs ${opponentName} (${matchDate}) - ID: ${shortId}`,
          value: match.id
        };
      });
    
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
    .setDescription('Schedule a match with another player')
    .addUserOption(option => 
      option.setName('opponent')
        .setDescription('The player you want to challenge')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league to schedule the match in')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option => 
      option.setName('date')
        .setDescription('Date of the match (YYYY-MM-DD)')
        .setRequired(false)
    )
    .addStringOption(option => 
      option.setName('time')
        .setDescription('Time of the match (HH:MM)')
        .setRequired(false)
    )
    .addBooleanOption(option => 
      option.setName('instant_match')
        .setDescription('Schedule an instant match (no date/time required)')
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
      const instantMatch = interaction.options.getBoolean('instant_match') || false;
      
      if (opponent.id === interaction.user.id) {
        return interaction.editReply('You cannot schedule a match against yourself.');
      }
      
      let scheduledDate: Date | undefined = undefined;
      
      // If not an instant match, validate and parse date/time
      if (!instantMatch) {
        if (!dateString) {
          return interaction.editReply('Please provide a date for the match or set instant_match to true.');
        }
        
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
        const match = await db.scheduleMatch(
          leagueName,
          interaction.user.id,
          opponent.id,
          scheduledDate
        );
        
        if (instantMatch) {
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
          
          const enrichedMatch = await db.getMatch(match.id);
          
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
          const enrichedMatch = await db.getMatch(match.id);
          const dateDisplay = formatDate(scheduledDate as Date);
          
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
    .setDescription('Report the result of a match')
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
    .setDescription('View all scheduled matches in a league')
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
          
          const leagueInfo = `League: ${match.league.name}`;
          const opponentId = interaction.user.id === match.player1Id ? match.player2Id : match.player1Id;
          
          embed.addFields({
            name: `Match #${index + 1}`,
            value: `**Players**: <@${match.player1Id}> vs <@${match.player2Id}>\n**Status**: ${match.status}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
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
    .setDescription('View your upcoming matches') as unknown as SlashCommandBuilder,
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Don't defer reply here since it's already deferred in index.ts
      
      try {
        const matches = await db.getMatchesByPlayer(interaction.user.id);
        
        if (matches.length === 0) {
          return interaction.editReply('You have no scheduled matches.');
        }
        
        // Filter to only show scheduled matches
        const scheduledMatches = matches.filter(match => match.status === MatchStatus.SCHEDULED);
        
        if (scheduledMatches.length === 0) {
          return interaction.editReply('You have no scheduled matches.');
        }
        
        // Create embed
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('Your Upcoming Matches')
          .setDescription(`You have ${scheduledMatches.length} scheduled matches.`)
          .setTimestamp()
          .setFooter({ text: 'Badge League Bot' });
        
        // Add each match
        scheduledMatches.forEach((match, index) => {
          // Determine opponent
          const isPlayer1 = match.player1Id === interaction.user.id;
          const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
          
          // Format date
          const dateInfo = match.scheduledDate 
            ? formatDate(match.scheduledDate) 
            : 'Instant match (no scheduled date)';
          
          // Confirmation status
          const player1Confirmed = match.player1Confirmed ? '✅' : '❌';
          const player2Confirmed = match.player2Confirmed ? '✅' : '❌';
          const confirmationStatus = `You: ${isPlayer1 ? player1Confirmed : player2Confirmed} | Opponent: ${isPlayer1 ? player2Confirmed : player1Confirmed}`;
          
          // Get league name
          const leagueInfo = `League ID: ${match.leagueId}`;
          
          embed.addFields({
            name: `Match #${index + 1}`,
            value: `**Opponent**: <@${opponentId}>\n**Status**: ${match.status}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
            inline: false
          });
        });
        
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
    } catch (error: any) {
      console.error('Error in my_matches command:', error);
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while retrieving your matches.');
      } else {
        await interaction.reply({ content: 'An error occurred while retrieving your matches.', ephemeral: true });
      }
    }
  }
};

// Cancel match command
const cancelMatchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cancel_match')
    .setDescription('Cancel a scheduled match')
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
