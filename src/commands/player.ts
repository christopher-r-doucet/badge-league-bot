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
                .filter((league: { name: string }) => league.name.toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map((league: { name: string }) => ({ name: league.name, value: league.name }));
                
            await interaction.respond(filtered);
        }
    },

    execute: async (interaction: ChatInputCommandInteraction) => {
        console.log(`Executing status command for interaction: ${interaction.id}`);
        
        const leagueName = interaction.options.getString('league');
        const guildId = interaction.guildId || undefined;
        
        // Get all leagues the player is in
        const playerLeagues = await db.getPlayerLeagues(interaction.user.id, guildId);
        
        if (playerLeagues.length === 0) {
            return interaction.editReply('You are not a member of any leagues. Join a league first with `/join_league`.');
        }
        
        let selectedLeague: { id: string, name: string } | undefined;
        
        // If a league name was provided, find that league
        if (leagueName) {
            selectedLeague = playerLeagues.find((league: { name: string }) => 
                league.name.toLowerCase() === leagueName.toLowerCase()
            );
            
            if (!selectedLeague) {
                return interaction.editReply(`You are not a member of the league "${leagueName}".`);
            }
        } 
        // Otherwise, try to get the default league
        else {
            const defaultLeagueName = await db.getDefaultLeague(interaction.user.id, guildId);
            
            if (defaultLeagueName) {
                selectedLeague = playerLeagues.find((league: { name: string }) => 
                    league.name === defaultLeagueName
                );
            }
            
            // If no default league or default league not found, use the first league
            if (!selectedLeague && playerLeagues.length > 0) {
                selectedLeague = playerLeagues[0];
            }
        }
        
        // If we have multiple leagues and no specific league was selected, show a league selector
        if (playerLeagues.length > 1 && !leagueName && !await db.getDefaultLeague(interaction.user.id, guildId)) {
            return showLeagueSelector(interaction, playerLeagues);
        }
        
        // Get player stats for the selected league
        const stats = await db.getPlayerStats(
            interaction.user.id, 
            selectedLeague?.name || '', 
            guildId
        );
        
        if (!stats) {
            return interaction.editReply('Could not find your stats. Please try again later.');
        }
        
        // Show player stats
        await showPlayerStats(interaction, stats);
    }
} as Command;

// Helper function to show a league selector
async function showLeagueSelector(interaction: ChatInputCommandInteraction, leagues: any[]) {
    try {
        // Create a select menu with all leagues
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('league_select')
            .setPlaceholder('Select a league')
            .addOptions(
                leagues.map((league: { id: string, name: string }) => ({
                    label: league.name,
                    value: league.id,
                    description: `View your stats in ${league.name}`
                }))
            );
        
        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);
        
        // Send the message with the select menu
        const response = await interaction.editReply({
            content: 'Select a league to view your stats:',
            components: [row]
        });
        
        // Create a collector for the select menu
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000 // 1 minute timeout
        });
        
        // Handle select menu interactions
        collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
            if (selectInteraction.user.id !== interaction.user.id) {
                await selectInteraction.reply({ content: 'This menu is not for you!', ephemeral: true });
                return;
            }
            
            const leagueId = selectInteraction.values[0];
            
            // Get stats for the selected league
            const stats = await db.getPlayerStats(
                interaction.user.id,
                leagues.find((league: { id: string }) => league.id === leagueId)?.name || '',
                interaction.guildId || undefined
            );
            
            if (!stats) {
                await selectInteraction.update({ content: 'Failed to get stats for the selected league.', components: [] });
                return;
            }
            
            // Show stats for the selected league
            await showPlayerStats(selectInteraction, stats, true);
            
            // End the collector
            collector.stop();
        });
        
        // Handle collector end
        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                // If the collector timed out and no interactions were collected
                await interaction.editReply({ content: 'League selection timed out.', components: [] });
            }
        });
    } catch (error) {
        console.error('Error showing league selector:', error);
        await interaction.editReply('An error occurred while showing the league selector.');
    }
}

// Helper function to show player stats
async function showPlayerStats(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction, stats: any, isUpdate = false) {
    try {
        // Get the league
        let league = null;
        if (stats.leagueId) {
            league = await db.getLeague(stats.leagueName || '', interaction.guildId || '');
        }
        
        const leagueDisplay = league ? league.name : 'No League';
        
        // Calculate win rate
        let winRate = '0%';
        if (stats.wins > 0 || stats.losses > 0) {
            const totalGames = stats.wins + stats.losses;
            const winRateValue = (stats.wins / totalGames) * 100;
            winRate = `${winRateValue.toFixed(1)}%`;
        }
        
        // Get badge image
        const badgePath = getBadgePath(stats.rank as Rank);
        const badgeFileName = badgePath.split('/').pop() || 'bronze.png';
        const badgeAttachment = new AttachmentBuilder(badgePath);
        
        // Create embed
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
                            league ? league.name : '', 
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
    } catch (error) {
        console.error('Error showing player stats:', error);
        if (!isUpdate) {
            await interaction.editReply('An error occurred while showing your stats.');
        }
    }
}

export const playerCommands = [
    playerStatusCommand
];
