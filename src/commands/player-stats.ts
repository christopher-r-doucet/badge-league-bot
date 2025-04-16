import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, User } from 'discord.js';
import { db } from '../database/index-new-complete.js';
import { formatDate } from '../utils/formatters.js';
import type { Command } from '../types/commands.js';

/**
 * Get rank color based on rank
 */
function getRankColor(rank: string): number {
  switch (rank) {
    case 'Bronze':
      return 0xCD7F32; // Bronze color
    case 'Silver':
      return 0xC0C0C0; // Silver color
    case 'Gold':
      return 0xFFD700; // Gold color
    case 'Diamond':
      return 0xB9F2FF; // Diamond color
    case 'Master':
      return 0x9932CC; // Purple color
    case 'Grandmaster':
      return 0xFF0000; // Red color
    default:
      return 0x0099FF; // Default blue
  }
}

/**
 * Get rank display with emoji
 */
function getRankDisplay(rank: string): string {
  switch (rank) {
    case 'Bronze':
      return '🥉 Bronze';
    case 'Silver':
      return '⚪ Silver';
    case 'Gold':
      return '🥇 Gold';
    case 'Diamond':
      return '💎 Diamond';
    case 'Master':
      return '👑 Master';
    case 'Grandmaster':
      return '🏆 Grandmaster';
    default:
      return rank;
  }
}

/**
 * Calculate win rate
 */
function calculateWinRate(wins: number, losses: number): string {
  if (wins === 0 && losses === 0) return '0%';
  const totalGames = wins + losses;
  const winRate = (wins / totalGames) * 100;
  return `${winRate.toFixed(1)}%`;
}

/**
 * Command to view player stats
 */
const playerStatsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('player_stats')
    .setDescription('View player stats')
    .addUserOption(option => 
      option.setName('player')
        .setDescription('The player to view stats for (defaults to you)')
        .setRequired(false)
    )
    .addStringOption(option => 
      option.setName('league')
        .setDescription('The league to view stats for')
        .setRequired(false)
        .setAutocomplete(true)
    ) as unknown as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const targetUser = interaction.options.getUser('player') || interaction.user;
      const leagueName = interaction.options.getString('league') || undefined;
      const guildId = interaction.guildId || undefined;
      
      // Use the new database structure
      const playerStats = await db.getPlayerStats(targetUser.id, leagueName, guildId);
      
      if (!playerStats) {
        if (targetUser.id === interaction.user.id) {
          return interaction.editReply(`You don't have any stats${leagueName ? ` in the league "${leagueName}"` : ''}.`);
        } else {
          return interaction.editReply(`${targetUser.username} doesn't have any stats${leagueName ? ` in the league "${leagueName}"` : ''}.`);
        }
      }
      
      // Get league info
      const league = await db.getLeague(playerStats.leagueName || '', guildId || '');
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(getRankColor(playerStats.rank))
        .setTitle(`${targetUser.username}'s Stats`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'League', value: league?.name || 'Unknown', inline: true },
          { name: 'Rank', value: getRankDisplay(playerStats.rank), inline: true },
          { name: 'ELO', value: playerStats.elo.toString(), inline: true },
          { name: 'Record', value: `${playerStats.wins}W - ${playerStats.losses}L`, inline: true },
          { name: 'Win Rate', value: calculateWinRate(playerStats.wins, playerStats.losses), inline: true },
          { name: 'Joined', value: formatDate(playerStats.joinedAt), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error('Error in player_stats command:', error);
      await interaction.editReply(`Error viewing player stats: ${error.message}`);
    }
  }
};

export default playerStatsCommand;
