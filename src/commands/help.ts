import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/commands.js';

const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows information about the bot and available commands'),
  
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
                '<:bronze:1361443594963255346> Bronze (Starting rank)\n' +
                '<:silver:1361443541070643443> Silver (1400+ ELO)\n' +
                '<:gold:1361443575543627822> Gold (1600+ ELO)\n' +
                '<:diamond:1361443608506532164> Diamond (2000+ ELO)\n' +
                '<:master:1361443524226322474> Master (Special rank)\n' +
                '<:grandmaster:1361443558128881814> Grandmaster (Special rank)'
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Badge League Bot' });

    // Create commands embed
    const commandsEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🤖 Available Commands')
      .setDescription('Here are all the commands you can use:')
      .addFields(
        { name: '/create_league', value: 'Create a new league for you and your friends', inline: true },
        { name: '/join_league', value: 'Join an existing league', inline: true },
        { name: '/list_leagues', value: 'See all available leagues', inline: true },
        { name: '/league_standings', value: 'View rankings in a specific league', inline: true },
        { name: '/invite_to_league', value: 'Invite someone to join your league', inline: true },
        { name: '/status', value: 'Check your current rank and stats', inline: true },
        { name: '/help', value: 'Show this help message', inline: true }
      )
      .addFields({
        name: '🚀 Getting Started',
        value: '1. Create a league with `/create_league`\n' +
               '2. Invite friends with `/invite_to_league`\n' +
               '3. Check standings with `/league_standings`\n' +
               '4. View your profile with `/status`'
      })
      .setTimestamp()
      .setFooter({ text: 'Badge League Bot' });

    await interaction.editReply({ embeds: [helpEmbed, commandsEmbed] });
  }
} as Command;

export const helpCommands = [
  helpCommand
];
