import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/commands.js';

const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows Information About the Bot and Available Commands'),
  deploymentType: 'global',
  
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    // Create main help embed
    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 Badge League Bot Help')
      .setDescription('Welcome to Badge League Bot! This bot helps you create and manage competitive leagues with your friends.')
      .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
      .addFields(
        { 
          name: '🎮 About Badge Leagues', 
          value: 'Badge Leagues are competitive gaming communities where players can compete, track their ELO rating, and earn badges based on their rank.' 
        },
        { 
          name: '🏆 Ranks & Badges', 
          value: 'As you win matches and increase your ELO, you\'ll progress through the ranks:\n' +
                '<:bronze:1361443594963255346> Bronze (Starting rank, below 1400 ELO)\n' +
                '<:silver:1361443541070643443> Silver (1400-1599 ELO)\n' +
                '<:gold:1361443575543627822> Gold (1600-1799 ELO)\n' +
                '<:diamond:1361443608506532164> Diamond (1800-1999 ELO)\n' +
                '<:master:1361443524226322474> Master (2000+ ELO)\n' +
                '<:grandmaster:1361443558128881814> Grandmaster (Exclusive rank - only the #1 player with 2200+ ELO in each league)'
        },
        {
          name: '👑 Grandmaster System',
          value: 'The Grandmaster rank is exclusive - only one player per league can hold it at a time!\n' +
                '• You need at least 2200 ELO to qualify\n' +
                '• Only the highest ELO player in each league gets the title\n' +
                '• If someone surpasses the current Grandmaster, they\'ll claim the title\n' +
                '• Former Grandmasters are demoted to Master rank\n' +
                'This creates an exciting "king of the hill" competition for the top spot!'
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Badge League Bot' });

    // Create league commands embed
    const leagueCommandsEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🏆 League Commands')
      .setDescription('Commands for managing leagues:')
      .addFields(
        { name: '/create_league_guild', value: 'Create a new league for you and your friends', inline: true },
        { name: '/join_league_guild', value: 'Join an existing league', inline: true },
        { name: '/list_leagues', value: 'See all available leagues', inline: true },
        { name: '/league_standings_guild', value: 'View rankings in a specific league', inline: true },
        { name: '/invite_to_league_guild', value: 'Invite someone to join your league', inline: true },
        { name: '/status', value: 'Check your current rank and stats', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Badge League Bot' });

    // Create match commands embed
    const matchCommandsEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('⚔️ Match Commands')
      .setDescription('Commands for scheduling and reporting matches:')
      .addFields(
        { name: '/schedule_match_guild', value: 'Schedule a match with another player', inline: true },
        { name: '/my_matches_guild', value: 'View your upcoming and completed matches', inline: true },
        { name: '/view_matches_guild', value: 'View all scheduled matches in a league', inline: true },
        { name: '/cancel_match_guild', value: 'Cancel a scheduled match', inline: true },
        { name: '/report_result_guild', value: 'Report the result of a completed match', inline: true }
      )
      .addFields({
        name: '📝 Reporting Match Results',
        value: 'After completing a match, use the "/report_result_guild" command or the "Report Result" button on your match message. You\'ll be asked if you won or lost - simply type "win" or "loss" to report your result. The system will automatically update rankings and ELO ratings.'
      })
      .addFields({
        name: '🚀 Getting Started',
        value: '1. Create a league with `/create_league_guild`\n' +
               '2. Invite friends with `/invite_to_league_guild`\n' +
               '3. Schedule matches with `/schedule_match_guild`\n' +
               '4. Report results using `/report_result_guild` or the "Report Result" button\n' +
               '5. Check standings with `/league_standings_guild`'
      })
      .setTimestamp()
      .setFooter({ text: 'Badge League Bot' });

    await interaction.editReply({ embeds: [helpEmbed, leagueCommandsEmbed, matchCommandsEmbed] });
  }
} as Command;

export const helpCommands = [
  helpCommand
];
