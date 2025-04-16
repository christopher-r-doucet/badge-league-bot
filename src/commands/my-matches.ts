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
  paginated.forEach((match, i) => {
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
        if (match.player1Confirmed === true && match.player2Confirmed === true) {
          matchStatusDisplay = 'Ready to play';
        } else {
          matchStatusDisplay = 'Waiting for acceptance';
        }
      }

      // Get league name
      const leagueInfo = match.league ? `League: ${match.league.name}` : `League ID: ${match.leagueId}`;

      embed.addFields({
        name: `Match #${start + i + 1}`,
        value: `**Opponent**: ${opponentName}\n**Status**: ${matchStatusDisplay}\n**Date**: ${dateInfo}\n**Confirmation**: ${confirmationStatus}\n**${leagueInfo}**\n**ID**: \`${match.id.substring(0, 8)}...\``,
        inline: false
      });
    } catch (error) {
      console.error(`Error processing match:`, error);
      // Skip this match if there's an error
    }
  });
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (page > 0) row.addComponents(new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary));
  if (end < matches.length) row.addComponents(new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary));
  await interaction.editReply({ embeds: [embed], components: row.components.length ? [row] : [] });
}

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
      
      // Only show active/upcoming matches by default
      const activeMatches = matches.filter(match => match.status !== MatchStatus.COMPLETED && match.status !== MatchStatus.CANCELLED);
      
      // Start at page 0
      await paginateMatches(interaction, activeMatches, 0);
    } catch (error) {
      await interaction.editReply('Failed to load matches.');
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
  }
};

export default myMatchesCommand;
