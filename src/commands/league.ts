import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js';
import type { Command } from '../types/commands.js';
import { db } from '../database/index.js';

// Helper function for league name autocomplete
async function handleLeagueAutocomplete(interaction: AutocompleteInteraction) {
  console.log('Fetching leagues for autocomplete...');
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const leagues = await db.getLeagues();
  console.log('Found leagues for autocomplete:', leagues);
  const filtered = leagues
    .filter(league => league.name.toLowerCase().includes(focusedValue))
    .slice(0, 25) // Discord has a limit of 25 choices
    .map(league => ({ name: league.name, value: league.name }));
  await interaction.respond(filtered);
}

// Helper function to safely reply to an interaction
async function safeReply(interaction: ChatInputCommandInteraction, content: string) {
  console.log(`Sending reply for interaction ${interaction.id}: ${content}`);
  await interaction.editReply({ content });
}

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
    console.log(`Executing create_league command for interaction: ${interaction.id}`);
    const name = interaction.options.getString('league_name', true);
    console.log(`Creating league with name: ${name}, interaction: ${interaction.id}`);

    await db.createLeague(name);
    console.log(`Created league: ${name}, interaction: ${interaction.id}`);
    
    await safeReply(interaction, `League "${name}" has been created!`);
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
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    await handleLeagueAutocomplete(interaction);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    console.log(`Executing join_league command for interaction: ${interaction.id}`);
    const name = interaction.options.getString('league_name', true);
    console.log(`Joining league with name: ${name}, interaction: ${interaction.id}`);

    await db.addPlayerToLeague(interaction, interaction.user.id, name);
    console.log(`Joined league: ${name}, interaction: ${interaction.id}`);
    
    await safeReply(interaction, `You have joined the league "${name}"!`);
  }
} as Command;

const listLeaguesCommand = {
  data: new SlashCommandBuilder()
    .setName('list_leagues')
    .setDescription('List all available leagues'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    console.log(`Executing list_leagues command for interaction: ${interaction.id}`);
    console.log(`Getting leagues for interaction: ${interaction.id}`);
    const leagues = await db.getLeagues();
    console.log(`Got leagues for interaction: ${interaction.id}`);
    
    if (leagues.length === 0) {
      console.log(`No leagues found for interaction: ${interaction.id}`);
      await safeReply(interaction, 'No leagues found');
      return;
    }
    
    const leagueList = leagues.map(league => `- ${league.name}`).join('\n');
    console.log(`Sending league list for interaction: ${interaction.id}`);
    await safeReply(interaction, `Available leagues:\n${leagueList}`);
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
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    await handleLeagueAutocomplete(interaction);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    console.log(`Executing league_standings command for interaction: ${interaction.id}`);
    const name = interaction.options.getString('league_name', true);
    console.log(`Getting standings for league: ${name}, interaction: ${interaction.id}`);

    const standings = await db.getLeagueStandings(name);
    console.log(`Got standings for league: ${name}, interaction: ${interaction.id}`);
    
    if (!standings || standings.length === 0) {
      console.log(`No players found in league: ${name}, interaction: ${interaction.id}`);
      await safeReply(interaction, `No players found in league "${name}"`);
      return;
    }

    const standingsList = standings
      .map((player, index) => 
        `${index + 1}. ${player.username} - ${player.elo} ELO (${player.rank})`
      )
      .join('\n');

    console.log(`Sending standings for league: ${name}, interaction: ${interaction.id}`);
    await safeReply(interaction, `Standings for "${name}":\n${standingsList}`);
  }
} as Command;

export const leagueCommands = [
  createLeagueCommand,
  joinLeagueCommand,
  listLeaguesCommand,
  leagueStandingsCommand
];
