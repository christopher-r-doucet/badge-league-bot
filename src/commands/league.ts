import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/commands.js';
import { db } from '../database/index.js';

const createLeagueCommand = {
  data: new SlashCommandBuilder()
    .setName('create_league')
    .setDescription('Create a new league')
    .addStringOption(option =>
      option
        .setName('league_name')
        .setDescription('The name of the league')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    // Defer reply immediately to prevent timeout
    await interaction.deferReply();

    try {
      // Since we marked it as required, we can safely use getString
      const name = interaction.options.getString('league_name', true);
      console.log('Creating league with name:', name);

      await db.createLeague(name);
      await interaction.editReply(`Created new league: ${name}`);
    } catch (error) {
      console.error('Error in create_league:', error);
      // Since we deferred, we must use editReply
      await interaction.editReply({ 
        content: error instanceof Error && error.message.includes('already exists')
          ? error.message
          : 'There was an error creating the league'
      });
    }
  }
} as Command;

const joinLeagueCommand = {
  data: new SlashCommandBuilder()
    .setName('join_league')
    .setDescription('Join a league')
    .addStringOption(option =>
      option
        .setName('league_name')
        .setDescription('The name of the league')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const name = interaction.options.getString('league_name', true);
      console.log('Joining league with name:', name);

      await db.addPlayerToLeague(interaction, interaction.user.id, name);
      await interaction.editReply(`You have joined the league: ${name}`);
    } catch (error) {
      console.error('Error in join_league:', error);
      await interaction.editReply({ 
        content: 'There was an error joining the league'
      });
    }
  }
} as Command;

const listLeaguesCommand = {
  data: new SlashCommandBuilder()
    .setName('list_leagues')
    .setDescription('List all available leagues'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const leagues = await db.getLeagues();
      console.log('Found leagues:', leagues);
      
      if (leagues.length === 0) {
        await interaction.editReply({
          content: 'No leagues found'
        });
        return;
      }
      
      const leagueList = leagues.map(league => `- ${league.name}`).join('\n');
      await interaction.editReply(`Available leagues:\n${leagueList}`);
    } catch (error) {
      console.error('Error in list_leagues:', error);
      await interaction.editReply({ 
        content: 'There was an error listing leagues'
      });
    }
  }
} as Command;

const leagueStandingsCommand = {
  data: new SlashCommandBuilder()
    .setName('league_standings')
    .setDescription('Show standings for a specific league')
    .addStringOption(option =>
      option
        .setName('league_name')
        .setDescription('The name of the league')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const name = interaction.options.getString('league_name', true);
      console.log('Getting standings for league:', name);

      const standings = await db.getLeagueStandings(name);
      
      if (!standings) {
        await interaction.editReply({
          content: `League not found: ${name}`
        });
        return;
      }
      
      const standingsList = standings
        .map((player, index) => 
          `${index + 1}. ${player.username} - ${player.elo} ELO (${player.rank})`
        )
        .join('\n');
      
      await interaction.editReply(`Standings for ${name}:\n${standingsList}`);
    } catch (error) {
      console.error('Error in league_standings:', error);
      await interaction.editReply({ 
        content: 'There was an error getting league standings'
      });
    }
  }
} as Command;

export const leagueCommands = [
  createLeagueCommand,
  joinLeagueCommand,
  listLeaguesCommand,
  leagueStandingsCommand
];
