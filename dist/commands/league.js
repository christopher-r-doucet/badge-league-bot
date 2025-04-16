import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { db } from '../database/index.js';
// Helper function for league name autocomplete
async function handleLeagueAutocomplete(interaction, onlyPlayerLeagues = false) {
    try {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const guildId = interaction.guildId || undefined;
        let leagues;
        if (onlyPlayerLeagues) {
            // Only get leagues the player is in
            leagues = await db.getPlayerLeagues(interaction.user.id, guildId);
        }
        else {
            // Get all leagues in the guild
            leagues = await db.getGuildLeagues(guildId);
        }
        const filtered = leagues
            .filter((league) => league.name.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map((league) => ({ name: league.name, value: league.name }));
        await interaction.respond(filtered);
    }
    catch (error) {
        console.error('Error in league autocomplete:', error);
        await interaction.respond([]);
    }
}
// Helper function to safely reply to an interaction
async function safeReply(interaction, content) {
    console.log(`Sending reply for interaction ${interaction.id}: ${content}`);
    await interaction.editReply({ content });
}
const createLeagueCommand = {
    data: new SlashCommandBuilder()
        .setName('create_league')
        .setDescription('Create a New League')
        .addStringOption(option => option.setName('name')
        .setDescription('The name of the league')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50)),
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        const name = interaction.options.getString('name', true);
        const guildId = interaction.guildId;
        // Ensure the command is used in a guild
        if (!guildId) {
            return interaction.editReply({ content: '❌ This command can only be used in a server.' });
        }
        try {
            // Create the league
            const league = await db.createLeague({
                name: name,
                guildId: interaction.guildId || '',
                creatorId: interaction.user.id // Store the creator's ID
            });
            // Create success embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎉 League Created!')
                .setDescription(`Successfully created league **${league.name}**`)
                .addFields({ name: 'Created by', value: interaction.user.username, inline: true }, { name: 'Players', value: '0', inline: true }, { name: '\u200B', value: '\u200B', inline: true }, {
                name: 'Next Steps',
                value: [
                    '1. Invite your friends with `/invite_to_league`',
                    '2. Join the league yourself with `/join_league`',
                    '3. Check standings with `/league_standings`'
                ].join('\n')
            })
                .setTimestamp()
                .setFooter({ text: 'Badge League Bot' });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            if (error instanceof Error) {
                await interaction.editReply({ content: `❌ ${error.message}` });
            }
            else {
                await interaction.editReply({ content: '❌ Failed to create league' });
            }
        }
    }
};
const joinLeagueCommand = {
    data: new SlashCommandBuilder()
        .setName('join_league')
        .setDescription('Join an Existing League')
        .addStringOption(option => option.setName('league')
        .setDescription('The name of the league')
        .setRequired(true)
        .setAutocomplete(true)),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'league') {
            await handleLeagueAutocomplete(interaction);
        }
    },
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        const leagueName = interaction.options.getString('league', true);
        const guildId = interaction.guildId;
        // Ensure the command is used in a guild
        if (!guildId) {
            return interaction.editReply({ content: '❌ This command can only be used in a server.' });
        }
        try {
            const player = await db.addPlayerToLeague(interaction.user.id, interaction.user.username, leagueName, guildId);
            // Create success embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎮 Joined League!')
                .setDescription(`Successfully joined **${leagueName}**`)
                .addFields({ name: 'Player', value: interaction.user.username, inline: true }, { name: 'Starting ELO', value: player.elo.toString(), inline: true }, { name: 'Rank', value: player.rank, inline: true })
                .setTimestamp()
                .setFooter({ text: 'Badge League Bot' });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            if (error instanceof Error) {
                await interaction.editReply({ content: `❌ ${error.message}` });
            }
            else {
                await interaction.editReply({ content: '❌ Failed to join league' });
            }
        }
    }
};
const listLeaguesCommand = {
    data: new SlashCommandBuilder()
        .setName('list_leagues')
        .setDescription('List All Available Leagues'),
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        const guildId = interaction.guildId;
        // Ensure the command is used in a guild
        if (!guildId) {
            return interaction.editReply({ content: '❌ This command can only be used in a server.' });
        }
        try {
            const leagues = await db.getGuildLeagues(guildId);
            if (leagues.length === 0) {
                return interaction.editReply({ content: 'No leagues found in this server. Create one with `/create_league`!' });
            }
            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Available Leagues')
                .setDescription(`Found ${leagues.length} leagues in this server`)
                .setTimestamp()
                .setFooter({ text: 'Badge League Bot' });
            // Add leagues to embed
            const leagueFields = await Promise.all(leagues.map(async (league, index) => {
                // Get player count for this league
                const players = await db.getLeaguePlayers(league.name);
                const playerCount = players.length;
                return {
                    name: `${index + 1}. ${league.name}`,
                    value: `**Players**: ${playerCount}\n**Created**: <t:${Math.floor(new Date(league.createdAt).getTime() / 1000)}:R>`,
                    inline: true
                };
            }));
            embed.addFields(leagueFields);
            // Add a blank field if we have an odd number of leagues
            if (leagueFields.length % 2 === 1) {
                embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
            }
            // Add instructions
            embed.addFields({
                name: 'How to Join',
                value: 'Use `/join_league` to join a league\nUse `/league_standings` to view rankings',
                inline: false
            });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            if (error instanceof Error) {
                await interaction.editReply({ content: `❌ ${error.message}` });
            }
            else {
                await interaction.editReply({ content: '❌ Failed to list leagues' });
            }
        }
    }
};
const leagueStandingsCommand = {
    data: new SlashCommandBuilder()
        .setName('league_standings')
        .setDescription('Show the League Standings and Rankings')
        .addStringOption(option => option.setName('league')
        .setDescription('The name of the league')
        .setRequired(true)
        .setAutocomplete(true)),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'league') {
            await handleLeagueAutocomplete(interaction);
        }
    },
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        const leagueName = interaction.options.getString('league', true);
        const guildId = interaction.guildId;
        // Ensure the command is used in a guild
        if (!guildId) {
            return interaction.editReply({ content: '❌ This command can only be used in a server.' });
        }
        try {
            // Get the league
            const league = await db.getLeague(leagueName, guildId || '');
            if (!league) {
                return interaction.editReply({ content: `❌ League "${leagueName}" not found` });
            }
            // Get players in the league sorted by ELO
            const players = await db.getLeagueLeaderboard(leagueName);
            if (players.length === 0) {
                return interaction.editReply({ content: `No players found in league "${leagueName}"` });
            }
            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${leagueName} - Standings`)
                .setDescription(`Current rankings for **${leagueName}**`)
                .setTimestamp()
                .setFooter({ text: 'Badge League Bot' });
            // Add player standings
            let standingsText = '';
            players.forEach((player, index) => {
                // Medal for top 3
                const medal = index === 0 ? '🥇' :
                    index === 1 ? '🥈' :
                        index === 2 ? '🥉' : '';
                // Rank emoji
                const rankEmoji = player.rank === 'Grandmaster' ? '<:grandmaster:1361443516487028777>' :
                    player.rank === 'Master' ? '<:master:1361443494722637854>' :
                        player.rank === 'Diamond' ? '<:diamond:1361443516487028777>' :
                            player.rank === 'Gold' ? '<:gold:1361443575543627822>' :
                                player.rank === 'Silver' ? '<:silver:1361443541070643443>' :
                                    player.rank === 'Bronze' ? '<:bronze:1361443594963255346>' : '•';
                standingsText += `${medal} **${index + 1}.** ${player.username}\n`;
                standingsText += `   ${rankEmoji} ${player.rank} • ELO: ${player.elo}\n`;
            });
            embed.addFields({ name: 'Rankings', value: standingsText });
            // Add some stats
            const avgElo = Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length);
            const highestElo = Math.max(...players.map((p) => p.elo));
            const lowestElo = Math.min(...players.map((p) => p.elo));
            embed.addFields({ name: 'League Stats', value: '\u200B', inline: false }, { name: 'Players', value: players.length.toString(), inline: true }, { name: 'Average ELO', value: avgElo.toString(), inline: true }, { name: 'ELO Range', value: `${lowestElo} - ${highestElo}`, inline: true });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            if (error instanceof Error) {
                await interaction.editReply({ content: `❌ ${error.message}` });
            }
            else {
                await interaction.editReply({ content: '❌ Failed to get league standings' });
            }
        }
    }
};
const inviteToLeagueCommand = {
    data: new SlashCommandBuilder()
        .setName('invite_to_league')
        .setDescription('Invite a Player to Join Your League')
        .addStringOption(option => option.setName('league')
        .setDescription('The name of the league')
        .setRequired(true)
        .setAutocomplete(true))
        .addUserOption(option => option.setName('player')
        .setDescription('The player to invite')
        .setRequired(true)),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'league') {
            await handleLeagueAutocomplete(interaction);
        }
    },
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        const leagueName = interaction.options.getString('league', true);
        const invitee = interaction.options.getUser('player', true);
        const inviter = interaction.user;
        const guildId = interaction.guildId;
        // Ensure the command is used in a guild
        if (!guildId) {
            return interaction.editReply({ content: '❌ This command can only be used in a server.' });
        }
        try {
            // Get the league
            const league = await db.getLeague(leagueName, guildId || '');
            if (!league) {
                return interaction.editReply({ content: `❌ League "${leagueName}" not found` });
            }
            // Check if inviter is in the league
            const inviterIsInLeague = await db.isPlayerInLeague(inviter.id, leagueName, guildId);
            if (!inviterIsInLeague) {
                return interaction.editReply({ content: `❌ You must be a member of the league to invite others` });
            }
            // Create a button for joining the league
            const joinButton = new ButtonBuilder()
                .setCustomId(`join_league:${league.name}:${invitee.id}`)
                .setLabel('Accept Invitation')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');
            const row = new ActionRowBuilder()
                .addComponents(joinButton);
            // Create an embed for the invitation
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`🎮 League Invitation`)
                .setDescription(`${invitee}, you've been invited to join **${league.name}**!`)
                .addFields({ name: 'Invited by', value: inviter.username, inline: true }, { name: 'League', value: league.name, inline: true }, { name: '\u200B', value: '\u200B', inline: true })
                .setTimestamp()
                .setFooter({ text: 'Badge League Bot' });
            // Send the invitation embed with the button
            await interaction.editReply({
                content: `<@${invitee.id}>`, // Mention the invitee
                embeds: [embed],
                components: [row]
            });
        }
        catch (error) {
            if (error instanceof Error) {
                await interaction.editReply({ content: `❌ ${error.message}` });
            }
            else {
                await interaction.editReply({ content: '❌ Failed to send invitation' });
            }
        }
    }
};
const leaveLeagueCommand = {
    data: new SlashCommandBuilder()
        .setName('leave_league')
        .setDescription('Leave a league you are currently in')
        .addStringOption(option => option.setName('league')
        .setDescription('The league you want to leave')
        .setRequired(true)
        .setAutocomplete(true)),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'league') {
            await handleLeagueAutocomplete(interaction, true); // true = only show leagues the player is in
        }
    },
    async execute(interaction) {
        try {
            await interaction.deferReply();
            const leagueName = interaction.options.getString('league', true);
            const guildId = interaction.guildId;
            // Check if the player is in the league
            const league = await db.getLeague(leagueName, guildId || '');
            if (!league) {
                return interaction.editReply(`League "${leagueName}" not found.`);
            }
            // Check if the player is in the league
            const player = await db.getPlayer(interaction.user.id, league.id);
            if (!player) {
                return interaction.editReply(`You are not a member of the "${leagueName}" league.`);
            }
            // Check if the player has any active matches
            const activeMatches = await db.getPlayerActiveMatches(interaction.user.id, league.id);
            if (activeMatches && activeMatches.length > 0) {
                return interaction.editReply(`You cannot leave the league while you have active matches. Please cancel or complete your matches first.`);
            }
            // Remove the player from the league
            await db.removePlayerFromLeague(interaction.user.id, league.id);
            return interaction.editReply(`You have successfully left the "${leagueName}" league.`);
        }
        catch (error) {
            console.error('Error executing leave_league command:', error);
            return interaction.editReply(`Error leaving league: ${error.message}`);
        }
    }
};
const deleteLeagueCommand = {
    data: new SlashCommandBuilder()
        .setName('delete_league')
        .setDescription('Delete a league (creator only, and only if empty)')
        .addStringOption(option => option.setName('league')
        .setDescription('The league you want to delete')
        .setRequired(true)
        .setAutocomplete(true))
        .addBooleanOption(option => option.setName('confirm')
        .setDescription('Confirm that you want to delete this league')
        .setRequired(true)),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'league') {
            await handleLeagueAutocomplete(interaction, true); // true = only show leagues the player is in
        }
    },
    async execute(interaction) {
        try {
            await interaction.deferReply();
            const leagueName = interaction.options.getString('league', true);
            const confirm = interaction.options.getBoolean('confirm', true);
            const guildId = interaction.guildId;
            if (!confirm) {
                return interaction.editReply('League deletion cancelled. You must confirm to delete a league.');
            }
            // Get the league
            const league = await db.getLeague(leagueName, guildId || '');
            if (!league) {
                return interaction.editReply(`League "${leagueName}" not found.`);
            }
            // Check if the user is the creator of the league
            const isCreator = await db.isLeagueCreator(league.id, interaction.user.id);
            if (!isCreator) {
                return interaction.editReply(`You are not the creator of the "${leagueName}" league. Only the creator can delete a league.`);
            }
            // Attempt to delete the league
            const deleted = await db.deleteLeague(league.id, interaction.user.id, guildId || '');
            if (!deleted) {
                return interaction.editReply(`Could not delete the "${leagueName}" league. Make sure there are no active matches and no players in the league.`);
            }
            return interaction.editReply(`The "${leagueName}" league has been successfully deleted.`);
        }
        catch (error) {
            console.error('Error executing delete_league command:', error);
            return interaction.editReply(`Error deleting league: ${error.message}`);
        }
    }
};
export const leagueCommands = [
    createLeagueCommand,
    joinLeagueCommand,
    listLeaguesCommand,
    leagueStandingsCommand,
    inviteToLeagueCommand,
    leaveLeagueCommand,
    deleteLeagueCommand
];
