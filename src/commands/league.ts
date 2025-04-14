import { CommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import type { Command } from './index.js';
import { db } from '../database/index.js';

const createCommand = (builder: SlashCommandOptionsOnlyBuilder): Command['data'] => {
  return builder as unknown as Command['data'];
};

const leagueCommands: Command[] = [
  {
    data: createCommand(
      new SlashCommandBuilder()
        .setName('create_league')
        .setDescription('Create a new league')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('The name of the league')
            .setRequired(true)
        )
    ),
    execute: async (interaction: CommandInteraction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const name = interaction.options.getString('name', true);
      await db.createLeague(name);
      
      await interaction.reply(`Created new league: ${name}`);
    }
  },
  {
    data: createCommand(
      new SlashCommandBuilder()
        .setName('join_league')
        .setDescription('Join a league')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('The name of the league')
            .setRequired(true)
        )
    ),
    execute: async (interaction: CommandInteraction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const name = interaction.options.getString('name', true);
      await db.addPlayerToLeague(interaction.user.id, name);
      
      await interaction.reply(`You have joined the league: ${name}`);
    }
  },
  {
    data: createCommand(
      new SlashCommandBuilder()
        .setName('list_leagues')
        .setDescription('List all available leagues')
    ),
    execute: async (interaction: CommandInteraction) => {
      const leagues = await db.getLeagues();
      
      if (leagues.length === 0) {
        await interaction.reply('No leagues found');
        return;
      }
      
      const leagueList = leagues.map(league => `- ${league.name}`).join('\n');
      await interaction.reply(`Available leagues:\n${leagueList}`);
    }
  },
  {
    data: createCommand(
      new SlashCommandBuilder()
        .setName('league_standings')
        .setDescription('Show standings for a specific league')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('The name of the league')
            .setRequired(true)
        )
    ),
    execute: async (interaction: CommandInteraction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const name = interaction.options.getString('name', true);
      const standings = await db.getLeagueStandings(name);
      
      if (!standings) {
        await interaction.reply(`League not found: ${name}`);
        return;
      }
      
      const standingsList = standings
        .map((player, index) => 
          `${index + 1}. ${player.username} - ${player.elo} ELO (${player.rank})`
        )
        .join('\n');
      
      await interaction.reply(`Standings for ${name}:\n${standingsList}`);
    }
  }
];

export { leagueCommands };
