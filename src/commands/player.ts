import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../types/commands.js';
import { db } from '../database/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory path for this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define valid ranks
type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster';

// Helper function to get badge file path based on rank
function getBadgePath(rank: Rank): string {
    const badgesDir = join(__dirname, '..', '..', 'badges');
    const badges: Record<Rank, string> = {
        'Bronze': join(badgesDir, 'bronze.png'),
        'Silver': join(badgesDir, 'silver.png'),
        'Gold': join(badgesDir, 'gold.png'),
        'Platinum': join(badgesDir, 'platinum.png'),
        'Diamond': join(badgesDir, 'diamond.png'),
        'Master': join(badgesDir, 'master.png'),
        'Grandmaster': join(badgesDir, 'grandmaster.png')
    };
    return badges[rank as Rank] || badges['Bronze']; // Default to Bronze if rank not found
}

// Helper function to get rank color
function getRankColor(rank: Rank): number {
    const colors: Record<Rank, number> = {
        'Bronze': 0xCD7F32,     // Bronze color
        'Silver': 0xC0C0C0,     // Silver color
        'Gold': 0xFFD700,       // Gold color
        'Platinum': 0xE5E4E2,   // Platinum color
        'Diamond': 0xB9F2FF,    // Diamond color
        'Master': 0x9370DB,     // Master color (purple)
        'Grandmaster': 0xFF4500  // Grandmaster color (red-orange)
    };
    return colors[rank as Rank] || colors['Bronze']; // Default to Bronze if rank not found
}

// Helper function to get rank emoji
function getRankEmoji(rank: Rank): string {
    switch (rank) {
        case 'Diamond': return '<:diamond:1361443608506532164>';
        case 'Grandmaster': return '<:grandmaster:1361443558128881814>';
        case 'Master': return '<:master:1361443524226322474>';
        case 'Gold': return '<:gold:1361443575543627822>';
        case 'Silver': return '<:silver:1361443541070643443>';
        case 'Bronze': return '<:bronze:1361443594963255346>';
        default: return '•';
    }
}

const playerStatusCommand = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show your current rank and stats'),

    execute: async (interaction: ChatInputCommandInteraction) => {
        console.log(`Executing status command for interaction: ${interaction.id}`);
        
        // Get player's stats from database
        const stats = await db.getPlayerStats(interaction.user.id);
        
        if (!stats) {
            await interaction.editReply('You haven\'t joined any leagues yet! Use `/join_league` to get started.');
            return;
        }

        // Create badge attachment
        const badgePath = getBadgePath(stats.rank as Rank);
        const badgeAttachment = new AttachmentBuilder(badgePath);
        const badgeFileName = badgePath.split('/').pop() || 'badge.png';

        // Create a rich embed for the player's status
        const embed = new EmbedBuilder()
            .setColor(getRankColor(stats.rank as Rank))
            .setTitle(`${getRankEmoji(stats.rank as Rank)} ${interaction.user.username}'s Profile`)
            .setThumbnail(`attachment://${badgeFileName}`)
            .addFields(
                { name: 'Current Rank', value: `${getRankEmoji(stats.rank as Rank)} ${stats.rank}`, inline: true },
                { name: 'ELO Rating', value: stats.elo.toString(), inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // Blank field for alignment
                { name: 'Wins', value: stats.wins.toString(), inline: true },
                { name: 'Losses', value: stats.losses.toString(), inline: true },
                { name: 'Win Rate', value: `${((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Badge League Bot', iconURL: interaction.client.user?.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed], files: [badgeAttachment] });
    }
} as Command;

export const playerCommands = [
    playerStatusCommand
];
