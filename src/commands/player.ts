import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, AutocompleteInteraction, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuInteraction, ButtonInteraction } from 'discord.js';
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
        .setDescription('Show Your Current Rank and Stats')
        .addStringOption(option =>
            option.setName('league')
                .setDescription('The league to show stats for (defaults to your default league)')
                .setRequired(false)
                .setAutocomplete(true)),

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'league') {
            const focusedValue = focusedOption.value.toLowerCase();
            const guildId = interaction.guildId || undefined;
            
            // Get leagues the player is in
            const playerLeagues = await db.getPlayerLeagues(interaction.user.id, guildId);
            
            const filtered = playerLeagues
                .filter(league => league.name.toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map(league => ({ name: league.name, value: league.name }));
                
            await interaction.respond(filtered);
        }
    },

    execute: async (interaction: ChatInputCommandInteraction) => {
        console.log(`Executing status command for interaction: ${interaction.id}`);
        
        const leagueName = interaction.options.getString('league');
        const guildId = interaction.guildId || undefined;
        
        // Get all leagues the player is in
        const playerLeagues = await db.getPlayerLeagues(interaction.user.id, guildId);
        
        // If player is only in one league, automatically set it as default if not already set
        if (playerLeagues.length === 1) {
            const defaultLeague = await db.getDefaultLeague(interaction.user.id, guildId);
            
            // If no default league is set or it's different from the only league they're in
            if (!defaultLeague || defaultLeague.id !== playerLeagues[0].id) {
                await db.setDefaultLeague(interaction.user.id, playerLeagues[0].id, guildId);
                console.log(`Automatically set ${playerLeagues[0].name} as default league for ${interaction.user.username}`);
            }
        }
        
        // If no league is specified, try to get the default league
        let selectedLeague = null;
        if (!leagueName) {
            selectedLeague = await db.getDefaultLeague(interaction.user.id, guildId);
        }
        
        // Get player's stats from database
        const stats = await db.getPlayerStats(
            interaction.user.id, 
            leagueName || (selectedLeague ? selectedLeague.name : undefined), 
            guildId
        );
        
        if (!stats) {
            if (playerLeagues.length === 0) {
                await interaction.editReply('You haven\'t joined any leagues yet! Use `/join_league` to get started.');
                return;
            } else if (leagueName) {
                await interaction.editReply(`You haven't joined the league "${leagueName}" yet! Use \`/join_league\` to get started.`);
                return;
            } else {
                // If player is in leagues but we couldn't get stats, show a league selector
                await showLeagueSelector(interaction, playerLeagues);
                return;
            }
        }

        await showPlayerStats(interaction, stats);
    }
} as Command;

// Helper function to show a league selector
async function showLeagueSelector(interaction: ChatInputCommandInteraction, leagues: any[]) {
    // Create a select menu for leagues
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('league_select')
        .setPlaceholder('Select a league to view your stats')
        .addOptions(
            leagues.map(league => ({
                label: league.name,
                value: league.id,
                description: `View your stats in ${league.name}`
            }))
        );
    
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);
    
    const response = await interaction.editReply({
        content: 'You are in multiple leagues. Please select one to view your stats:',
        components: [row]
    });
    
    // Create a collector for the select menu
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000 // 1 minute timeout
    });
    
    collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
        if (selectInteraction.user.id !== interaction.user.id) {
            await selectInteraction.reply({ content: 'This menu is not for you!', ephemeral: true });
            return;
        }
        
        const leagueId = selectInteraction.values[0];
        const league = leagues.find(l => l.id === leagueId);
        
        if (!league) {
            await selectInteraction.update({ content: 'League not found. Please try again.', components: [] });
            return;
        }
        
        // Get player stats for the selected league
        const stats = await db.getPlayerStats(interaction.user.id, league.name, interaction.guildId || undefined);
        
        if (!stats) {
            await selectInteraction.update({ 
                content: `Could not find your stats in league "${league.name}". Please try again.`,
                components: []
            });
            return;
        }
        
        // Show player stats
        await showPlayerStats(selectInteraction, stats, true);
        
        // End the collector
        collector.stop();
    });
    
    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            await interaction.editReply({
                content: 'League selection timed out. Please try again.',
                components: []
            });
        }
    });
}

// Helper function to show player stats
async function showPlayerStats(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction, stats: any, isUpdate = false) {
    // Create badge attachment
    const badgePath = getBadgePath(stats.rank as Rank);
    const badgeAttachment = new AttachmentBuilder(badgePath);
    const badgeFileName = badgePath.split('/').pop() || 'badge.png';

    // Get league information
    const league = await db.getLeagueById(stats.leagueId);
    const leagueDisplay = league ? `${league.name}` : 'Unknown League';

    // Calculate win rate safely
    const totalMatches = stats.wins + stats.losses;
    const winRate = totalMatches > 0 
        ? `${((stats.wins / totalMatches) * 100).toFixed(1)}%` 
        : 'No matches yet';

    // Create a rich embed for the player's status
    const embed = new EmbedBuilder()
        .setColor(getRankColor(stats.rank as Rank))
        .setTitle(`${getRankEmoji(stats.rank as Rank)} ${interaction.user.username}'s Profile`)
        .setThumbnail(`attachment://${badgeFileName}`)
        .addFields(
            { name: 'League', value: leagueDisplay, inline: false },
            { name: 'Current Rank', value: `${getRankEmoji(stats.rank as Rank)} ${stats.rank}`, inline: true },
            { name: 'ELO Rating', value: stats.elo.toString(), inline: true },
            { name: '\u200B', value: '\u200B', inline: true }, // Blank field for alignment
            { name: 'Wins', value: stats.wins.toString(), inline: true },
            { name: 'Losses', value: stats.losses.toString(), inline: true },
            { name: 'Win Rate', value: winRate, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot • Today at ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) });

    // Create a button to set this league as default
    const setDefaultButton = new ButtonBuilder()
        .setCustomId(`set_default_league:${stats.leagueId}`)
        .setLabel('Set as Default League')
        .setStyle(ButtonStyle.Primary);
    
    // Create a button to view other leagues
    const viewOtherLeaguesButton = new ButtonBuilder()
        .setCustomId('view_other_leagues')
        .setLabel('View Other Leagues')
        .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(setDefaultButton, viewOtherLeaguesButton);
    
    // Get all leagues the player is in
    const playerLeagues = await db.getPlayerLeagues(interaction.user.id, interaction.guildId || undefined);
    
    // Only show buttons if player is in multiple leagues
    const components = playerLeagues.length > 1 ? [row] : [];
    
    // Send or update the message
    if (isUpdate) {
        await (interaction as StringSelectMenuInteraction | ButtonInteraction).update({ 
            content: null,
            embeds: [embed], 
            files: [badgeAttachment],
            components
        });
    } else {
        const response = await interaction.editReply({ 
            embeds: [embed], 
            files: [badgeAttachment],
            components
        });
        
        // Set up button collectors
        if (components.length > 0) {
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minute timeout
            });
            
            collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({ content: 'This button is not for you!', ephemeral: true });
                    return;
                }
                
                const customId = buttonInteraction.customId;
                
                if (customId.startsWith('set_default_league:')) {
                    const leagueId = customId.split(':')[1];
                    
                    // Set as default league
                    await db.setDefaultLeague(
                        interaction.user.id, 
                        leagueId, 
                        interaction.guildId || undefined
                    );
                    
                    await buttonInteraction.reply({ 
                        content: `${league ? league.name : 'This league'} has been set as your default league!`,
                        ephemeral: true
                    });
                } else if (customId === 'view_other_leagues') {
                    // Show league selector
                    await showLeagueSelector(interaction as ChatInputCommandInteraction, playerLeagues);
                    
                    // End the collector
                    collector.stop();
                }
            });
        }
    }
}

export const playerCommands = [
    playerStatusCommand
];
