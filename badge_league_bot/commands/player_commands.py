from discord import app_commands, Interaction
from ..bot import command_decorator
from ..database.db import db
from ..utils.error_handler import handle_command_error
from ..utils.elo import get_rank

@command_decorator(name="register", description="Register as a player")
@app_commands.describe(player_name="Your player name")
async def register(interaction: Interaction, player_name: str):
    try:
        print(f"Received register command from {interaction.user}")
        db.cursor.execute('''
            INSERT INTO players (discord_id, player_name)
            VALUES (?, ?)
        ''', (interaction.user.id, player_name))
        db.conn.commit()
        await interaction.response.send_message(f"Successfully registered as {player_name}!")
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "register")
        await interaction.response.send_message(error_msg)

@command_decorator(name="status", description="Check your current status")
async def status(interaction: Interaction):
    try:
        print(f"Received status command from {interaction.user}")
        db.cursor.execute('''
            SELECT wins, losses, elo_rating
            FROM players
            WHERE discord_id = ?
        ''', (interaction.user.id,))
        
        result = db.cursor.fetchone()
        if not result:
            await interaction.response.send_message("You are not registered! Use /register first.")
            return
            
        wins, losses, elo_rating = result
        rank, rank_emoji = get_rank(elo_rating)
        await interaction.response.send_message(f"Your record: {wins} wins, {losses} losses, ELO: {elo_rating} ({rank} {rank_emoji})")
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "status")
        await interaction.response.send_message(error_msg)

@command_decorator(name="standings", description="Display global standings")
async def standings(interaction: Interaction):
    try:
        print(f"Received standings command from {interaction.user}")
        db.cursor.execute('''
            SELECT 
                player_name,
                wins,
                losses,
                elo_rating
            FROM players
            ORDER BY elo_rating DESC
        ''')
        players = db.cursor.fetchall()
        
        if not players:
            await interaction.response.send_message("No players registered yet!")
            return
            
        # Create table
        table = "```\nGlobal Standings\n"
        table += "=" * 65 + "\n"
        table += f"{'Rank':<6} {'Player':<15} {'W':<5} {'L':<5} {'Win%':<8} {'ELO':<8} {'Tier':<10}\n"
        table += "-" * 65 + "\n"
        
        # Add each player to the table
        for i, player in enumerate(players, 1):
            name, wins, losses, elo = player
            win_rate = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0
            rank, _ = get_rank(elo)
            
            table += f"{i:<6} {name:<15} {wins:<5} {losses:<5} {win_rate:>6.1f}% {elo:>7.0f} {rank}\n"
        
        table += "```"
        
        # Add rank explanation
        rank_explanation = "\nRank Tiers:\n"
        for rank, (min_elo, max_elo) in RANKS.items():
            emoji = RANK_EMOJIS[rank]
            rank_explanation += f"{emoji} {rank}: {min_elo}-{max_elo} ELO\n"
        
        await interaction.response.send_message(table + rank_explanation)
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "standings")
        await interaction.response.send_message(error_msg)
