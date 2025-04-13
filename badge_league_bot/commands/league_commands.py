from discord import app_commands, Interaction
import logging
from ..bot import command_decorator
from ..database.db import db
from ..utils.error_handler import handle_command_error
from ..utils.elo import get_rank
from ..constants import RANKS, RANK_EMOJIS

logger = logging.getLogger('discord')

@command_decorator(name="create_league", description="Create a new league")
@app_commands.describe(league_name="Name for the new league")
async def create_league(interaction: Interaction, league_name: str):
    try:
        logger.info(f"Received create_league command from {interaction.user}")
        
        # Defer the response since we're doing database operations
        await interaction.response.defer(ephemeral=True)
        
        # First check if the player is registered
        db.cursor.execute('SELECT 1 FROM players WHERE discord_id = ?', (interaction.user.id,))
        if not db.cursor.fetchone():
            await interaction.followup.send("You must register first using /register before creating a league!", ephemeral=True)
            return
            
        db.cursor.execute('INSERT INTO leagues (league_name) VALUES (?)', (league_name,))
        league_id = db.cursor.lastrowid
        
        # Automatically add creator to the league
        db.cursor.execute('''
            INSERT INTO league_players (league_id, player_id)
            VALUES (?, ?)
        ''', (league_id, interaction.user.id))
        
        db.conn.commit()
        await interaction.followup.send(f"Successfully created league '{league_name}'! You have been automatically added as a member.")
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "create_league")
        if not interaction.response.is_done():
            await interaction.response.send_message(error_msg, ephemeral=True)
        else:
            await interaction.followup.send(error_msg, ephemeral=True)

@command_decorator(name="join_league", description="Join a league")
@app_commands.describe(league_name="Name of the league to join")
async def join_league(interaction: Interaction, league_name: str):
    try:
        logger.info(f"Received join_league command from {interaction.user}")
        
        # Defer the response since we're doing database operations
        await interaction.response.defer(ephemeral=True)
        
        # First check if the league exists
        db.cursor.execute('SELECT league_id FROM leagues WHERE league_name = ?', (league_name,))
        league = db.cursor.fetchone()
        if not league:
            await interaction.followup.send(f"League '{league_name}' does not exist!", ephemeral=True)
            return
            
        # Then check if the player is registered
        db.cursor.execute('SELECT 1 FROM players WHERE discord_id = ?', (interaction.user.id,))
        if not db.cursor.fetchone():
            await interaction.followup.send("You must register first using /register before joining a league!", ephemeral=True)
            return
            
        # Add player to league
        db.cursor.execute('''
            INSERT INTO league_players (league_id, player_id)
            VALUES (?, ?)
        ''', (league[0], interaction.user.id))
        db.conn.commit()
        
        await interaction.followup.send(f"Successfully joined league '{league_name}'!")
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "join_league")
        if not interaction.response.is_done():
            await interaction.response.send_message(error_msg, ephemeral=True)
        else:
            await interaction.followup.send(error_msg, ephemeral=True)

@command_decorator(name="list_leagues", description="List all available leagues")
async def list_leagues(interaction: Interaction):
    try:
        logger.info(f"Received list_leagues command from {interaction.user}")
        
        # Defer the response since we're doing database operations
        await interaction.response.defer()
        
        db.cursor.execute('''
            SELECT 
                l.league_name,
                COUNT(lp.player_id) as player_count
            FROM leagues l
            LEFT JOIN league_players lp ON l.league_id = lp.league_id
            GROUP BY l.league_id, l.league_name
            ORDER BY l.league_name
        ''')
        leagues = db.cursor.fetchall()
        
        if not leagues:
            await interaction.followup.send("No leagues exist yet! Create one using /create_league")
            return
            
        # Create table
        table = "```\nAvailable Leagues\n"
        table += "=" * 40 + "\n"
        table += f"{'League Name':<25} {'Players':<8}\n"
        table += "-" * 40 + "\n"
        
        for league in leagues:
            name, count = league
            table += f"{name:<25} {count:<8}\n"
        
        table += "```"
        await interaction.followup.send(table)
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "list_leagues")
        if not interaction.response.is_done():
            await interaction.response.send_message(error_msg, ephemeral=True)
        else:
            await interaction.followup.send(error_msg, ephemeral=True)

@command_decorator(name="league_standings", description="Show standings for a specific league")
@app_commands.describe(league_name="Name of the league to show standings for")
async def league_standings(interaction: Interaction, league_name: str):
    try:
        logger.info(f"Received league_standings command from {interaction.user}")
        
        # Defer the response since we're doing database operations
        await interaction.response.defer()
        
        # First check if the league exists
        db.cursor.execute('SELECT 1 FROM leagues WHERE league_name = ?', (league_name,))
        if not db.cursor.fetchone():
            await interaction.followup.send(f"League '{league_name}' does not exist!")
            return
            
        db.cursor.execute('''
            SELECT 
                p.player_name,
                lp.league_wins,
                lp.league_losses,
                lp.league_elo
            FROM league_players lp
            JOIN players p ON lp.player_id = p.discord_id
            JOIN leagues l ON lp.league_id = l.league_id
            WHERE l.league_name = ?
            ORDER BY lp.league_elo DESC
        ''', (league_name,))
        players = db.cursor.fetchall()
        
        if not players:
            await interaction.followup.send(f"No players found in league '{league_name}'!")
            return
            
        # Create table
        table = f"```\n{league_name} Standings\n"
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
        
        await interaction.followup.send(table + rank_explanation)
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "league_standings")
        if not interaction.response.is_done():
            await interaction.response.send_message(error_msg, ephemeral=True)
        else:
            await interaction.followup.send(error_msg, ephemeral=True)
