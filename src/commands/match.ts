import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/commands.js';
import { db } from '../database/index.js';

const registerCommand = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register as a player'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    try {
      await db.registerPlayer(interaction.user.id, interaction.user.username);
      await interaction.editReply('You have been registered as a player!');
    } catch (error) {
      console.error('Error in register:', error);
      await interaction.editReply({ 
        content: 'There was an error registering you as a player'
      });
    }
  }
} as Command;

const scheduleCommand = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule a match with another player')
    .addUserOption(option =>
      option
        .setName('opponent')
        .setDescription('The player you want to schedule a match with')
        .setRequired(true)
    )
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
      const opponent = interaction.options.getUser('opponent', true);
      const leagueName = interaction.options.getString('league_name', true);
      
      await db.scheduleMatch(
        interaction.user.id,
        opponent.id,
        leagueName
      );
      
      await interaction.editReply(
        `Match scheduled with ${opponent.username} in league "${leagueName}"`
      );
    } catch (error) {
      console.error('Error in schedule:', error);
      await interaction.editReply({ 
        content: 'There was an error scheduling the match'
      });
    }
  }
} as Command;

const scheduleTableCommand = {
  data: new SlashCommandBuilder()
    .setName('schedule_table')
    .setDescription('Display the league schedule in a table format')
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
      const leagueName = interaction.options.getString('league_name', true);
      const matches = await db.getScheduledMatches(leagueName);
      
      if (!matches || matches.length === 0) {
        await interaction.editReply('No scheduled matches found');
        return;
      }

      const schedule = matches
        .map(match => 
          `${match.player1Name} vs ${match.player2Name}`
        )
        .join('\n');
      
      await interaction.editReply(`Scheduled Matches:\n\`\`\`\n${schedule}\n\`\`\``);
    } catch (error) {
      console.error('Error in schedule_table:', error);
      await interaction.editReply({ 
        content: 'There was an error displaying the schedule'
      });
    }
  }
} as Command;

const reportCommand = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report the result of a match')
    .addUserOption(option =>
      option
        .setName('opponent')
        .setDescription('The player you played against')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('league_name')
        .setDescription('The name of the league')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50)
    )
    .addBooleanOption(option =>
      option
        .setName('won')
        .setDescription('Did you win the match?')
        .setRequired(true)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    try {
      const opponent = interaction.options.getUser('opponent', true);
      const leagueName = interaction.options.getString('league_name', true);
      const won = interaction.options.getBoolean('won', true);
      
      await db.reportMatch(
        interaction.user.id,
        opponent.id,
        leagueName,
        won
      );
      
      await interaction.editReply(
        `Match result reported: ${won ? 'Victory' : 'Defeat'} against ${opponent.username}`
      );
    } catch (error) {
      console.error('Error in report:', error);
      await interaction.editReply({ 
        content: 'There was an error reporting the match result'
      });
    }
  }
} as Command;

const matchesCommand = {
  data: new SlashCommandBuilder()
    .setName('matches')
    .setDescription('View your upcoming matches')
    .addStringOption(option =>
      option
        .setName('league_name')
        .setDescription('The name of the league (optional)')
        .setRequired(false)
        .setMinLength(1)
        .setMaxLength(50)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    try {
      const leagueName = interaction.options.getString('league_name');
      const matches = await db.getPlayerMatches(
        interaction.user.id,
        leagueName || undefined
      );
      
      if (!matches || matches.length === 0) {
        await interaction.editReply('No upcoming matches found');
        return;
      }

      const matchList = matches
        .map(match => 
          `vs ${match.opponent} in ${match.leagueName}`
        )
        .join('\n');
      
      await interaction.editReply(`Your Upcoming Matches:\n${matchList}`);
    } catch (error) {
      console.error('Error in matches:', error);
      await interaction.editReply({ 
        content: 'There was an error getting your matches'
      });
    }
  }
} as Command;

const statusCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your current status')
    .addStringOption(option =>
      option
        .setName('league_name')
        .setDescription('The name of the league (optional)')
        .setRequired(false)
        .setMinLength(1)
        .setMaxLength(50)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    try {
      const leagueName = interaction.options.getString('league_name');
      const status = await db.getPlayerStatus(
        interaction.user.id,
        leagueName || undefined
      );
      
      if (!status) {
        await interaction.editReply('No status found. Are you registered?');
        return;
      }

      const statusText = leagueName
        ? `Status in ${leagueName}:\nELO: ${status.elo}\nRank: ${status.rank}\nMatches Played: ${status.matchesPlayed}`
        : `Overall Status:\nTotal Matches: ${status.totalMatches}\nWin Rate: ${status.winRate}%\nActive Leagues: ${status.activeLeagues.join(', ')}`;
      
      await interaction.editReply(statusText);
    } catch (error) {
      console.error('Error in status:', error);
      await interaction.editReply({ 
        content: 'There was an error getting your status'
      });
    }
  }
} as Command;

export const matchCommands = [
  registerCommand,
  scheduleCommand,
  scheduleTableCommand,
  reportCommand,
  matchesCommand,
  statusCommand
];
