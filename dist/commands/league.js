import { SlashCommandBuilder } from 'discord.js';
import { db } from '../database/index.js';
const createCommand = (builder) => {
    return builder;
};
const leagueCommands = [
    {
        data: createCommand(new SlashCommandBuilder()
            .setName('create_league')
            .setDescription('Create a new league')
            .addStringOption(option => option
            .setName('name')
            .setDescription('The name of the league')
            .setRequired(true))),
        execute: async (interaction) => {
            try {
                if (!interaction.isChatInputCommand())
                    return;
                const name = interaction.options.getString('name');
                if (!name) {
                    await interaction.reply({
                        content: 'Please provide a league name',
                        ephemeral: true
                    });
                    return;
                }
                await db.createLeague(name);
                await interaction.reply(`Created new league: ${name}`);
            }
            catch (error) {
                console.error('Error in create_league:', error);
                await interaction.reply({
                    content: 'There was an error creating the league',
                    ephemeral: true
                });
            }
        }
    },
    {
        data: createCommand(new SlashCommandBuilder()
            .setName('join_league')
            .setDescription('Join a league')
            .addStringOption(option => option
            .setName('name')
            .setDescription('The name of the league')
            .setRequired(true))),
        execute: async (interaction) => {
            try {
                if (!interaction.isChatInputCommand())
                    return;
                const name = interaction.options.getString('name');
                if (!name) {
                    await interaction.reply({
                        content: 'Please provide a league name',
                        ephemeral: true
                    });
                    return;
                }
                await db.addPlayerToLeague(interaction.user.id, name);
                await interaction.reply(`You have joined the league: ${name}`);
            }
            catch (error) {
                console.error('Error in join_league:', error);
                await interaction.reply({
                    content: 'There was an error joining the league',
                    ephemeral: true
                });
            }
        }
    },
    {
        data: createCommand(new SlashCommandBuilder()
            .setName('list_leagues')
            .setDescription('List all available leagues')),
        execute: async (interaction) => {
            try {
                const leagues = await db.getLeagues();
                if (leagues.length === 0) {
                    await interaction.reply('No leagues found');
                    return;
                }
                const leagueList = leagues.map(league => `- ${league.name}`).join('\n');
                await interaction.reply(`Available leagues:\n${leagueList}`);
            }
            catch (error) {
                console.error('Error in list_leagues:', error);
                await interaction.reply({
                    content: 'There was an error listing leagues',
                    ephemeral: true
                });
            }
        }
    },
    {
        data: createCommand(new SlashCommandBuilder()
            .setName('league_standings')
            .setDescription('Show standings for a specific league')
            .addStringOption(option => option
            .setName('name')
            .setDescription('The name of the league')
            .setRequired(true))),
        execute: async (interaction) => {
            try {
                if (!interaction.isChatInputCommand())
                    return;
                const name = interaction.options.getString('name');
                if (!name) {
                    await interaction.reply({
                        content: 'Please provide a league name',
                        ephemeral: true
                    });
                    return;
                }
                const standings = await db.getLeagueStandings(name);
                if (!standings) {
                    await interaction.reply(`League not found: ${name}`);
                    return;
                }
                const standingsList = standings
                    .map((player, index) => `${index + 1}. ${player.username} - ${player.elo} ELO (${player.rank})`)
                    .join('\n');
                await interaction.reply(`Standings for ${name}:\n${standingsList}`);
            }
            catch (error) {
                console.error('Error in league_standings:', error);
                await interaction.reply({
                    content: 'There was an error getting league standings',
                    ephemeral: true
                });
            }
        }
    }
];
export { leagueCommands };
