import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction, EmbedBuilder, CommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../types/commands.js';
import { db } from '../database/index.js';

// Helper function for league name autocomplete
async function handleLeagueAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const guildId = interaction.guildId || undefined;
  
  // Only show leagues for the current guild
  const leagues = await db.getLeagues(guildId);
  
  const filtered = leagues
    .filter((league) => league.name.toLowerCase().includes(focusedValue))
    .slice(0, 25) // Discord has a limit of 25 choices
    .map((league) => ({ name: league.name, value: league.name }));
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
      option.setName('name')
        .setDescription('The name of the league')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.options.getString('name', true);
    const guildId = interaction.guildId;
    
    // Ensure the command is used in a guild
    if (!guildId) {
      return interaction.editReply({ content: '❌ This command can only be used in a server.' });
    }

    try {
      const league = await db.createLeague(name, guildId);
      
      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎉 League Created!')
        .setDescription(`Successfully created league **${league.name}**`)
        .addFields(
          { name: 'Created by', value: interaction.user.username, inline: true },
          { name: 'Players', value: '0', inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { 
            name: 'Next Steps',
            value: [
              '1. Invite your friends with `/invite_to_league`',
              '2. Join the league yourself with `/join_league`',
              '3. Check standings with `/league_standings`'
            ].join('\n')
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to create league' });
      }
    }
  }
} as Command;

const joinLeagueCommand = {
  data: new SlashCommandBuilder()
    .setName('join_league')
    .setDescription('Join an existing league')
    .addStringOption(option =>
      option.setName('league')
        .setDescription('The name of the league')
        .setRequired(true)
        .setAutocomplete(true)),
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'league') {
      await handleLeagueAutocomplete(interaction);
    }
  },
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

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
        .setTitle('✅ Welcome to the League!')
        .setDescription(`Successfully joined **${leagueName}**`)
        .addFields(
          { name: 'Player', value: interaction.user.username, inline: true },
          { name: 'Starting ELO', value: '1000', inline: true },
          { name: 'Starting Rank', value: 'Bronze', inline: true },
          { 
            name: 'Next Steps',
            value: [
              '• Check your stats with `/status`',
              '• View league standings with `/league_standings`',
              '• Invite friends with `/invite_to_league`'
            ].join('\n')
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to join league' });
      }
    }
  }
} as Command;

const listLeaguesCommand = {
  data: new SlashCommandBuilder()
    .setName('list_leagues')
    .setDescription('List all available leagues'),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    try {
      const guildId = interaction.guildId || undefined;
      const leagues = await db.getLeagues(guildId);

      if (leagues.length === 0) {
        await interaction.editReply({ content: 'No leagues found. Create one with `/create_league`!' });
        return;
      }

      // Create the leagues embed
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🏆 Available Leagues')
        .setDescription('Here are all the leagues you can join:')
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });

      // Add leagues list
      let leaguesText = '';
      
      // Use Promise.all to handle async operations in forEach
      await Promise.all(leagues.map(async (league, index) => {
        leaguesText += `${index + 1}. **${league.name}**\n`;
        
        // Get player count for this league
        const playerCount = await db.getPlayerCountByLeague(league.name);
        leaguesText += `   • Players: ${playerCount}\n`;
      }));

      embed.addFields({ 
        name: 'Leagues', 
        value: leaguesText || 'No leagues available'
      });

      // Add instructions
      embed.addFields({
        name: 'How to Join',
        value: 'Use `/join_league` to join a league\nOr create your own with `/create_league`!'
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to list leagues' });
      }
    }
  }
} as Command;

const leagueStandingsCommand = {
  data: new SlashCommandBuilder()
    .setName('league_standings')
    .setDescription('Show the standings for a league')
    .addStringOption(option =>
      option.setName('league')
        .setDescription('The name of the league')
        .setRequired(true)
        .setAutocomplete(true)),
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'league') {
      await handleLeagueAutocomplete(interaction);
    }
  },
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const leagueName = interaction.options.getString('league', true);

    try {
      const players = await db.getLeagueStandings(leagueName);

      if (!players) {
        await interaction.editReply({ content: `❌ League "${leagueName}" not found` });
        return;
      }

      if (players.length === 0) {
        await interaction.editReply({ content: `No players found in league "${leagueName}"` });
        return;
      }

      // Create the standings embed
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`📊 ${leagueName} - League Standings`)
        .setDescription('Here are the current rankings:')
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });

      // Add player standings
      let standingsText = '';
      players.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
        const rankEmoji = player.rank === 'Diamond' ? '<:diamond:1361443608506532164>' : 
                         player.rank === 'Grandmaster' ? '<:grandmaster:1361443558128881814>' :
                         player.rank === 'Master' ? '<:master:1361443524226322474>' :
                         player.rank === 'Gold' ? '<:gold:1361443575543627822>' :
                         player.rank === 'Silver' ? '<:silver:1361443541070643443>' :
                         player.rank === 'Bronze' ? '<:bronze:1361443594963255346>' : '•';
        
        standingsText += `${medal} **${index + 1}.** ${player.username}\n`;
        standingsText += `   ${rankEmoji} ${player.rank} • ELO: ${player.elo}\n`;
      });

      embed.addFields({ name: 'Rankings', value: standingsText });

      // Add some stats
      const avgElo = Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length);
      const highestElo = Math.max(...players.map(p => p.elo));
      const lowestElo = Math.min(...players.map(p => p.elo));

      embed.addFields(
        { name: 'League Stats', value: '\u200B', inline: false },
        { name: 'Players', value: players.length.toString(), inline: true },
        { name: 'Average ELO', value: avgElo.toString(), inline: true },
        { name: 'ELO Range', value: `${lowestElo} - ${highestElo}`, inline: true }
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to get league standings' });
      }
    }
  }
} as Command;

const inviteToLeagueCommand = {
  data: new SlashCommandBuilder()
    .setName('invite_to_league')
    .setDescription('Invite a player to join your league')
    .addStringOption(option =>
      option.setName('league')
        .setDescription('The name of the league')
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption(option =>
      option.setName('player')
        .setDescription('The player to invite')
        .setRequired(true)),
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'league') {
      await handleLeagueAutocomplete(interaction);
    }
  },
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const leagueName = interaction.options.getString('league', true);
    const invitee = interaction.options.getUser('player', true);
    const inviter = interaction.user;

    try {
      const { league, inviter: inviterStats } = await db.invitePlayerToLeague(leagueName, inviter.id, invitee.id);

      // Create a button for joining the league
      const joinButton = new ButtonBuilder()
        .setCustomId(`join_league:${league.name}:${invitee.id}`)
        .setLabel('Accept Invitation')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(joinButton);

      // Create an embed for the invitation
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`🎮 League Invitation`)
        .setDescription(`${invitee}, you've been invited to join **${league.name}**!`)
        .addFields(
          { name: 'Invited by', value: inviter.username, inline: true },
          { name: 'League', value: league.name, inline: true },
          { name: '\u200B', value: '\u200B', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Badge League Bot' });

      // Send the invitation embed with the button
      await interaction.editReply({ 
        content: `<@${invitee.id}>`,  // Mention the invitee
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      if (error instanceof Error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
      } else {
        await interaction.editReply({ content: '❌ Failed to send invitation' });
      }
    }
  }
} as Command;

export const leagueCommands = [
  createLeagueCommand,
  joinLeagueCommand,
  listLeaguesCommand,
  leagueStandingsCommand,
  inviteToLeagueCommand
];
