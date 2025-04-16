import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../database/index.js';
import { MatchStatus } from '../entities/Match.js';
import { formatDate } from '../utils/formatters.js';
import type { Command } from '../types/commands.js';

/**
 * Command to view a user's matches
 */
const myMatchesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('my_matches')
    .setDescription('View My Matches (upcoming and completed) [Guild]')
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
      
      // Use the new database structure
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

export default myMatchesCommand;
