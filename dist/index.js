import { Client, Events, GatewayIntentBits, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands/index.js';
import { db } from './database/index.js';
import { formatDate } from './utils/formatters.js';
import myMatchesCommand from './commands/my-matches.js';
// Load environment variables only in non-production environments
if (process.env.NODE_ENV !== 'production') {
    config({ path: '.env.local' });
}
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});
client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            // Handle slash commands
            await handleSlashCommand(interaction);
        }
        else if (interaction.isButton()) {
            // Handle button interactions
            await handleButtonInteraction(interaction);
        }
        else if (interaction.isModalSubmit()) {
            // Handle modal submissions
            await handleModalSubmit(interaction);
        }
        else if (interaction.isStringSelectMenu()) {
            // Handle select menu interactions
            await handleSelectMenuInteraction(interaction);
        }
        else if (interaction.isAutocomplete()) {
            // Handle autocomplete interactions
            await handleAutocomplete(interaction);
        }
    }
    catch (error) {
        console.error('Error handling interaction:', error);
        // Try to respond to the interaction if it hasn't been responded to yet
        try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                });
            }
            else if (interaction.isRepliable() && !interaction.replied && interaction.deferred) {
                await interaction.editReply('There was an error while executing this command!');
            }
        }
        catch (replyError) {
            console.error('Error replying to interaction after error:', replyError);
        }
    }
});
// Handle slash commands
async function handleSlashCommand(interaction) {
    // Get the command from our command collection
    const command = commands.get(interaction.commandName);
    // Log command execution
    console.log(`Executing command: ${interaction.commandName} ${command?.deploymentType === 'global' ? '(GLOBAL)' : '(guild command)'} for user: ${interaction.user.username}`);
    // Determine if this command should use ephemeral replies
    const ephemeralCommands = ['my_matches_guild', 'status'];
    const shouldBeEphemeral = ephemeralCommands.includes(interaction.commandName);
    // Defer reply to give us time to process
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: shouldBeEphemeral });
        }
    }
    catch (error) {
        console.error('Error deferring reply:', error);
    }
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(`Error executing ${interaction.commandName} command:`, error);
        try {
            if (!interaction.replied) {
                await interaction.editReply({ content: 'There was an error while executing this command!' });
            }
        }
        catch (replyError) {
            console.error('Error sending error reply:', replyError);
        }
    }
}
// Handle button interactions
async function handleButtonInteraction(interaction) {
    console.log(`Processing button interaction: ${interaction.customId}`);
    const customId = interaction.customId;
    // Pagination for my_matches
    if (['next_page', 'prev_page'].includes(customId)) {
        if (myMatchesCommand && typeof myMatchesCommand.handleComponent === 'function') {
            await myMatchesCommand.handleComponent(interaction);
        }
        return;
    }
    // Per-match cancel button for my_matches
    if (customId.startsWith('cancel_match:')) {
        const matchId = customId.split(':')[1];
        // Call a cancel handler in myMatchesCommand if it exists, otherwise handle here
        if (myMatchesCommand && typeof myMatchesCommand.cancelMatch === 'function') {
            await myMatchesCommand.cancelMatch(interaction, matchId);
        }
        else {
            // Fallback: cancel match and update UI
            try {
                await db.cancelMatch(matchId, interaction.user.id);
                await interaction.reply({ content: 'Match cancelled.', ephemeral: true });
            }
            catch (error) {
                await interaction.reply({ content: 'Failed to cancel match.', ephemeral: true });
            }
        }
        return;
    }
    try {
        // Handle match-related buttons
        if (customId.startsWith('match_accept:')) {
            const [_, matchId] = customId.split(':');
            await handleMatchAccept(interaction, matchId);
            return;
        }
        if (customId.startsWith('match_decline:')) {
            const [_, matchId] = customId.split(':');
            await handleMatchDecline(interaction, matchId);
            return;
        }
        if (customId.startsWith('match_confirm:')) {
            const [_, matchId] = customId.split(':');
            await handleMatchConfirm(interaction, matchId);
            return;
        }
        if (customId.startsWith('match_report:')) {
            const [_, matchId] = customId.split(':');
            await handleMatchReport(interaction, matchId);
            return;
        }
        if (customId.startsWith('match_cancel:')) {
            const [_, matchId] = customId.split(':');
            await handleMatchCancel(interaction, matchId);
            return;
        }
        // Handle league join buttons
        if (customId.startsWith('join_league:')) {
            await interaction.deferReply({ ephemeral: true });
            try {
                const [_, leagueName, targetUserId] = customId.split(':');
                // Verify the user clicking is the invited user
                if (interaction.user.id !== targetUserId) {
                    await interaction.editReply({ content: 'This invitation is for someone else.' });
                    return;
                }
                // Get the guild ID from the interaction
                const guildId = interaction.guildId;
                if (!guildId) {
                    await interaction.editReply({ content: 'This command can only be used in a server.' });
                    return;
                }
                // Add the player to the league
                await db.addPlayerToLeague(interaction.user.id, interaction.user.username, leagueName, guildId);
                // Create success message
                await interaction.editReply({
                    content: `✅ You've successfully joined **${leagueName}**! Check your status with \`/status\`.`
                });
                // Update the original message to show the invitation was accepted
                const originalEmbed = interaction.message.embeds[0];
                const updatedEmbed = {
                    ...originalEmbed.data,
                    color: 0x00FF00, // Green color
                    title: '✅ League Invitation Accepted',
                };
                await interaction.message.edit({
                    embeds: [updatedEmbed],
                    components: [] // Remove buttons
                });
            }
            catch (error) {
                console.error('Error handling league join:', error);
                await interaction.editReply({ content: 'There was an error joining the league. Please try again later.' });
            }
            return;
        }
        // If we get here, it's an unknown button type
        await interaction.reply({ content: 'Unknown button action', ephemeral: true });
    }
    catch (error) {
        console.error(`Error handling button interaction: ${error}`);
        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: 'An error occurred while processing the button' });
            }
            else {
                await interaction.reply({ content: 'An error occurred while processing the button', ephemeral: true });
            }
        }
        catch (replyError) {
            console.error('Error sending error response:', replyError);
        }
    }
    return;
}
// Handle modal submissions
async function handleModalSubmit(interaction) {
    if (!interaction.isModalSubmit())
        return;
    const [action, id] = interaction.customId.split(':');
    if (action === 'report_match') {
        try {
            await interaction.deferReply();
            const resultValue = interaction.fields.getTextInputValue('match_result').toLowerCase().trim();
            if (resultValue !== 'win' && resultValue !== 'loss') {
                return interaction.editReply('Invalid result. Please enter either "win" or "loss".');
            }
            const isWin = resultValue === 'win';
            // Get match details first to determine player positions
            const matchBefore = await db.getMatch(id);
            if (!matchBefore) {
                return interaction.editReply('Match not found.');
            }
            // Check if user is a participant
            const isPlayer1 = matchBefore.player1.discordId === interaction.user.id;
            const isPlayer2 = matchBefore.player2.discordId === interaction.user.id;
            if (!isPlayer1 && !isPlayer2) {
                return interaction.editReply('You are not a participant in this match.');
            }
            // Determine scores based on win/loss
            // Use a standard score of 1-0 for win/loss
            let player1Score, player2Score;
            if (isPlayer1) {
                player1Score = isWin ? 1 : 0;
                player2Score = isWin ? 0 : 1;
            }
            else {
                player1Score = isWin ? 0 : 1;
                player2Score = isWin ? 1 : 0;
            }
            // Report the result
            const updatedMatch = await db.reportMatchResult(id, interaction.user.id, player1Score, player2Score);
            // Get enriched match with player details
            const enrichedMatch = await db.getMatch(id);
            const winner = player1Score > player2Score ? enrichedMatch.player1 : enrichedMatch.player2;
            const loser = player1Score > player2Score ? enrichedMatch.player2 : enrichedMatch.player1;
            // Calculate ELO change based on the difference between winner and loser ELO
            // Using the standard ELO formula K-factor of 32
            const expectedScore = 1 / (1 + Math.pow(10, (winner.elo - loser.elo) / 400));
            const eloChange = Math.round(32 * (1 - expectedScore));
            // Format ELO changes with colors and emojis
            const winnerEloText = `${winner.elo} (\`\`\`diff\n+${eloChange}\n\`\`\`) 📈`;
            const loserEloText = `${loser.elo} (\`\`\`diff\n-${eloChange}\n\`\`\`) 📉`;
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Match Result Reported')
                .setDescription(`Match in ${enrichedMatch.league.name} has been completed!`)
                .addFields({ name: 'Winner 🏆', value: `<@${winner.discordId}>`, inline: true }, { name: 'Loser 😔', value: `<@${loser.discordId}>`, inline: true }, { name: 'New ELO 📊', value: `${winner.username}: ${winnerEloText}\n${loser.username}: ${loserEloText}`, inline: false });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error(`Error handling match report: ${error}`);
            await interaction.editReply('An error occurred while reporting the match result.');
        }
    }
}
// Handle select menu interactions
async function handleSelectMenuInteraction(interaction) {
    // Not implemented
}
// Handle autocomplete interactions
async function handleAutocomplete(interaction) {
    if (!interaction.isAutocomplete())
        return;
    try {
        // Find the command that matches the autocomplete request
        const command = commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
            return;
        }
        if (!command.autocomplete) {
            console.error(`Command ${interaction.commandName} does not have an autocomplete handler.`);
            return;
        }
        // Log autocomplete request
        console.log(`Processing autocomplete for command: ${interaction.commandName}, option: ${interaction.options.getFocused(true).name}`);
        // Execute the command's autocomplete handler
        await command.autocomplete(interaction);
    }
    catch (error) {
        console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
        // We can't reply to autocomplete interactions with an error message,
        // so we'll just log it and return an empty array
        await interaction.respond([]);
    }
}
// Match button handlers
async function handleMatchAccept(interaction, matchId) {
    try {
        await interaction.deferReply();
        // Get match details first to check if the user is the challenger
        const matchDetails = await db.getMatch(matchId);
        if (!matchDetails) {
            return interaction.editReply('Match not found.');
        }
        // Check if the user trying to accept is the one who created the match
        // We need to compare Discord IDs, not database IDs
        if (matchDetails.player1.discordId === interaction.user.id) {
            return interaction.editReply('You cannot accept your own match challenge. The other player must accept it.');
        }
        // Check if the match is already fully confirmed
        if (matchDetails.player1Confirmed && matchDetails.player2Confirmed) {
            return interaction.editReply('This match has already been accepted and is ready to play!');
        }
        // Proceed with match confirmation
        const match = await db.confirmMatch(matchId, interaction.user.id);
        const enrichedMatch = await db.getMatch(matchId);
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Match Accepted')
            .setDescription(`${interaction.user} has accepted the match challenge!`)
            .addFields({ name: 'League', value: enrichedMatch.league.name, inline: true }, { name: 'Players', value: `<@${enrichedMatch.player1.discordId}> vs <@${enrichedMatch.player2.discordId}>`, inline: true }, { name: 'Status', value: 'Ready to play!', inline: true });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        await interaction.editReply(`Error accepting match: ${error.message}`);
    }
}
async function handleMatchDecline(interaction, matchId) {
    try {
        await interaction.deferReply();
        const match = await db.cancelMatch(matchId, interaction.user.id);
        const enrichedMatch = await db.getMatch(matchId);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Match Declined')
            .setDescription(`${interaction.user} has declined the match challenge.`)
            .addFields({ name: 'League', value: enrichedMatch.league.name, inline: true }, { name: 'Challenger', value: `<@${enrichedMatch.player1.discordId}>`, inline: true });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        await interaction.editReply(`Error declining match: ${error.message}`);
    }
}
async function handleMatchConfirm(interaction, matchId) {
    try {
        await interaction.deferReply();
        const match = await db.confirmMatch(matchId, interaction.user.id);
        const enrichedMatch = await db.getMatch(matchId);
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Match Confirmed')
            .setDescription(`${interaction.user} has confirmed the match!`)
            .addFields({ name: 'League', value: enrichedMatch.league.name, inline: true }, { name: 'Players', value: `<@${enrichedMatch.player1.discordId}> vs <@${enrichedMatch.player2.discordId}>`, inline: true }, { name: 'Status', value: 'Ready to play!', inline: true });
        if (enrichedMatch.scheduledDate) {
            embed.addFields({
                name: 'Scheduled For',
                value: formatDate(new Date(enrichedMatch.scheduledDate)),
                inline: true
            });
        }
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        await interaction.editReply(`Error confirming match: ${error.message}`);
    }
}
async function handleMatchReport(interaction, matchId) {
    try {
        // Create a modal for match result reporting
        const modal = new ModalBuilder()
            .setCustomId(`report_match:${matchId}`)
            .setTitle('Report Match Result');
        // Add a select component for win/loss
        const resultInput = new TextInputBuilder()
            .setCustomId('match_result')
            .setLabel('Did you win the match?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Type "win" or "loss"')
            .setRequired(true);
        // Add input to action row
        const resultRow = new ActionRowBuilder().addComponents(resultInput);
        // Add action row to modal
        modal.addComponents(resultRow);
        // Show the modal
        await interaction.showModal(modal);
    }
    catch (error) {
        console.error(`Error showing report modal: ${error}`);
        await interaction.reply({ content: 'An error occurred while preparing the report form', ephemeral: true });
    }
}
async function handleMatchCancel(interaction, matchId) {
    try {
        await interaction.deferReply();
        const match = await db.cancelMatch(matchId, interaction.user.id);
        const enrichedMatch = await db.getMatch(matchId);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Match Cancelled')
            .setDescription(`${interaction.user} has cancelled the match.`)
            .addFields({ name: 'League', value: enrichedMatch.league.name, inline: true }, { name: 'Players', value: `<@${enrichedMatch.player1.discordId}> vs <@${enrichedMatch.player2.discordId}>`, inline: true });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        await interaction.editReply(`Error cancelling match: ${error.message}`);
    }
}
// Initialize database and start bot
async function main() {
    try {
        await db.init();
        await client.login(process.env.DISCORD_TOKEN);
    }
    catch (error) {
        console.error('Failed to start the bot:', error);
        process.exit(1);
    }
}
main();
