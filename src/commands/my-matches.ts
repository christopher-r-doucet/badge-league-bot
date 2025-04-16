import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { db } from '../database/index.js';
import { MatchStatus } from '../entities/Match.js';
import { formatDate } from '../utils/formatters.js';
import type { Command } from '../types/commands.js';

/**
 * Command to view a user's matches
 */
// Helper function for paginating matches
async function paginateMatches(interaction: ButtonInteraction | ChatInputCommandInteraction, matches: any[], page: number) {
  const start = page * 5;
  const end = start + 5;
  const paginated = matches.slice(start, end);
  const embed = new EmbedBuilder()
    .setTitle('Your Matches')
    .setDescription(`Page ${page + 1} of ${Math.ceil(matches.length / 5)}`);
  const row = new ActionRowBuilder<ButtonBuilder>();
  paginated.forEach((match, i) => {
    try {
      if (!match) return; // Skip if match is undefined
      
      // Safely determine opponent and display names/mentions
      const isPlayer1 = match.player1 && match.player1.discordId === interaction.user.id;
      const opponent = isPlayer1 ? match.player2 : match.player1;
      let opponentDisplay = 'Unknown player';
      if (opponent) {
        if (opponent.username) {
          opponentDisplay = opponent.username;
        } else if (opponent.discordId) {
          opponentDisplay = `<@${opponent.discordId}>`;
        }
      }

      // Defensive check for match.status
      const matchStatus = match.status || 'Unknown';
      // Format date
      const dateInfo = match.scheduledDate 
        ? formatDate(match.scheduledDate) 
        : 'Instant match (no scheduled date)';
      // Defensive checks for confirmation fields
      const player1Confirmed = typeof match.player1Confirmed === 'boolean' ? (match.player1Confirmed ? '✅' : '❌') : '❓';
      const player2Confirmed = typeof match.player2Confirmed === 'boolean' ? (match.player2Confirmed ? '✅' : '❌') : '❓';
      const confirmationStatus = `You: ${isPlayer1 ? player1Confirmed : player2Confirmed} | Opponent: ${isPlayer1 ? player2Confirmed : player1Confirmed}`;
      // Get match status with confirmation details
      let matchStatusDisplay = matchStatus;
      if (matchStatus === MatchStatus.SCHEDULED) {
        if (match.player1Confirmed === true && match.player2Confirmed === true) {
          matchStatusDisplay = 'Ready to play';
        } else {
          matchStatusDisplay = 'Waiting for acceptance';
        }
      }
      // Get league name
      let leagueInfo = 'No league';
      if (match.league && match.league.name) {
        leagueInfo = `League: ${match.league.name}`;
      } else if (match.leagueId) {
        leagueInfo = `League ID: ${match.leagueId}`;
      }
      // Add per-match cancel button if active/upcoming
      let components = [];
      if (matchStatus === MatchStatus.SCHEDULED) {
        components.push(
          new ButtonBuilder()
            .setCustomId(`cancel_match:${match.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );
      }
      // Defensive check for match.id
      const matchIdDisplay = match.id ? `\`${String(match.id).substring(0, 8)}...\`` : '`Unknown ID`';
      embed.addFields({
        name: `Match #${start + i + 1}`,
        value: `**Opponent**: ${opponentDisplay}\n**Status**: ${matchStatusDisplay}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: ${matchIdDisplay}`,
        inline: false
      });

      // Add a row for the cancel button if present
      if (components.length) {
        embed.addFields({
          name: '\u200B',
          value: '\u200B',
          inline: false
        });
        row.addComponents(...components);
      }
    } catch (error) {
      console.error(`Error processing match:`, error, match);
      // Skip this match if there's an error
    }
  });
  if (page > 0) row.addComponents(new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary));
  if (end < matches.length) row.addComponents(new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [embed], components: row.components.length ? [row] : [] });
}

const myMatchesCommand = {
  data: new SlashCommandBuilder()
    .setName('my_matches')
    .setDescription('View My Matches (upcoming and completed) [Guild]')
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league to view matches for')
        .setRequired(false)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
  deploymentType: 'global',
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Always defer reply as ephemeral
      await interaction.deferReply({ ephemeral: true });
      const guildId = interaction.guildId || undefined;
      // Debug: log user and guild
      console.log('[my_matches] user:', interaction.user.id, 'guild:', guildId);
      // Use the new database structure
      let matches;
      try {
        matches = await db.getPlayerMatches(interaction.user.id, undefined, guildId);
        console.log('[my_matches] matches returned:', matches);
      } catch (dbError) {
        console.error('[my_matches] DB error:', dbError);
        throw dbError;
      }
      if (!matches || matches.length === 0) {
        return interaction.editReply({ content: 'You have no matches in this server.' });
      }
      // Only show active/upcoming matches by default
      const activeMatches = matches.filter(match => match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED);
      console.log('[my_matches] active matches:', activeMatches);
      // Start at page 0
      await paginateMatches(interaction, activeMatches, 0);
    } catch (error) {
      console.error('[my_matches] Failed to load matches:', error);
      await interaction.editReply({ content: 'Failed to load matches.' });
    }
  },

  handleComponent: async function(interaction: ButtonInteraction) {
    if (!interaction.isButton()) return;
    const guildId = interaction.guildId || undefined;
    const matches = await db.getPlayerMatches(interaction.user.id, undefined, guildId);
    const activeMatches = matches.filter(match => match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED);
    let page = Number(interaction.message.embeds[0]?.description?.match(/Page (\d+)/)?.[1] || 1) - 1;
    if (interaction.customId === 'next_page') page++;
    if (interaction.customId === 'prev_page') page--;
    await paginateMatches(interaction, activeMatches, page);
    await interaction.deferUpdate();
  },

  cancelMatch: async function(interaction: ButtonInteraction, matchId: string) {
    try {
      await db.cancelMatch(matchId, interaction.user.id);
      // Refresh the match list for the user (keep ephemeral)
      const guildId = interaction.guildId || undefined;
      const matches = await db.getPlayerMatches(interaction.user.id, undefined, guildId);
      const activeMatches = matches.filter(match => match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED);
      await interaction.update({
        content: 'Match cancelled.',
        embeds: [],
        components: []
      });
      // Show updated match list
      await paginateMatches(interaction, activeMatches, 0);
    } catch (error) {
      await interaction.reply({ content: 'Failed to cancel match.', ephemeral: true });
    }
  }
} as Command;

export default myMatchesCommand;
