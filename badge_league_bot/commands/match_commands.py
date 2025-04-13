from typing import Literal
import discord
from discord import app_commands, Interaction
from ..bot import command_decorator
from ..database.db import db
from ..utils.error_handler import handle_command_error
from ..utils.elo import calculate_elo_change

@command_decorator(name="schedule", description="Schedule a match with another player")
@app_commands.describe(
    opponent="Your opponent",
    time="When the match will be played (e.g. '2024-01-01 15:00')"
)
async def schedule(interaction: Interaction, opponent: discord.Member, time: str):
    try:
        print(f"Received schedule command from {interaction.user}")
        
        # Check if opponent is registered
        db.cursor.execute('SELECT discord_id FROM players WHERE discord_id = ?', (opponent.id,))
        opponent_id = db.cursor.fetchone()
        if not opponent_id:
            await interaction.response.send_message(f"{opponent.name} is not registered!")
            return
            
        # Create match
        db.cursor.execute('''
            INSERT INTO matches (player1_id, player2_id, scheduled_time)
            VALUES (?, ?, ?)
        ''', (interaction.user.id, opponent_id[0], time))
        db.conn.commit()
        await interaction.response.send_message(f"Match scheduled with {opponent} at {time}")
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "schedule")
        await interaction.response.send_message(error_msg)

@command_decorator(name="schedule_table", description="Display the league schedule in a table format")
async def schedule_table(interaction: Interaction):
    try:
        print(f"Received schedule_table command from {interaction.user}")
        db.cursor.execute('''
            SELECT 
                p1.player_name as player1,
                p2.player_name as player2,
                m.scheduled_time,
                m.status
            FROM matches m
            JOIN players p1 ON m.player1_id = p1.discord_id
            JOIN players p2 ON m.player2_id = p2.discord_id
            ORDER BY m.scheduled_time ASC
        ''')
        matches = db.cursor.fetchall()
        
        if not matches:
            await interaction.response.send_message("No matches scheduled!")
            return
            
        # Create table
        table = "```\nMatch Schedule\n"
        table += "=" * 65 + "\n"
        table += f"{'Player 1':<20} {'Player 2':<20} {'Time':<15} {'Status':<10}\n"
        table += "-" * 65 + "\n"
        
        for match in matches:
            player1, player2, time, status = match
            table += f"{player1:<20} {player2:<20} {time:<15} {status:<10}\n"
        
        table += "```"
        await interaction.response.send_message(table)
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "schedule_table")
        await interaction.response.send_message(error_msg)

@command_decorator(name="report", description="Report a match result")
@app_commands.describe(
    opponent="Your opponent",
    result="Did you win or lose?",
    league_name="Name of the league this match belongs to (optional)"
)
async def report(interaction: Interaction, opponent: discord.Member, result: Literal["win", "loss"], league_name: str = None):
    try:
        print(f"Received report command from {interaction.user}")
        
        # Check if both players are registered
        db.cursor.execute('SELECT player_name, elo_rating FROM players WHERE discord_id = ?', (interaction.user.id,))
        player1 = db.cursor.fetchone()
        if not player1:
            raise ValueError("You must register first using /register before reporting matches!")
            
        db.cursor.execute('SELECT player_name, elo_rating FROM players WHERE discord_id = ?', (opponent.id,))
        player2 = db.cursor.fetchone()
        if not player2:
            raise ValueError(f"{opponent.name} must register first using /register before you can report matches with them!")
            
        # Get league info if specified
        league_id = None
        if league_name:
            db.cursor.execute('SELECT league_id FROM leagues WHERE league_name = ?', (league_name,))
            league = db.cursor.fetchone()
            if not league:
                raise ValueError(f"League '{league_name}' does not exist!")
            league_id = league[0]
            
            # Check if both players are in the league
            db.cursor.execute('SELECT 1 FROM league_players WHERE league_id = ? AND player_id = ?', (league_id, interaction.user.id))
            if not db.cursor.fetchone():
                raise ValueError(f"You are not a member of league '{league_name}'!")
                
            db.cursor.execute('SELECT 1 FROM league_players WHERE league_id = ? AND player_id = ?', (league_id, opponent.id))
            if not db.cursor.fetchone():
                raise ValueError(f"{opponent.name} is not a member of league '{league_name}'!")
        
        # Determine winner and loser
        if result == "win":
            winner_id = interaction.user.id
            loser_id = opponent.id
            winner_name = player1[0]
            loser_name = player2[0]
            winner_elo = player1[1]
            loser_elo = player2[1]
        else:
            winner_id = opponent.id
            loser_id = interaction.user.id
            winner_name = player2[0]
            loser_name = player1[0]
            winner_elo = player2[1]
            loser_elo = player1[1]
            
        # Calculate ELO changes
        winner_change, loser_change = calculate_elo_change(winner_elo, loser_elo)
        
        # Update global stats
        db.cursor.execute('''
            UPDATE players 
            SET wins = wins + 1, elo_rating = elo_rating + ?
            WHERE discord_id = ?
        ''', (winner_change, winner_id))
        
        db.cursor.execute('''
            UPDATE players 
            SET losses = losses + 1, elo_rating = elo_rating + ?
            WHERE discord_id = ?
        ''', (loser_change, loser_id))
        
        # Update league stats if applicable
        if league_id:
            db.cursor.execute('''
                UPDATE league_players 
                SET league_wins = league_wins + 1, league_elo = league_elo + ?
                WHERE league_id = ? AND player_id = ?
            ''', (winner_change, league_id, winner_id))
            
            db.cursor.execute('''
                UPDATE league_players 
                SET league_losses = league_losses + 1, league_elo = league_elo + ?
                WHERE league_id = ? AND player_id = ?
            ''', (loser_change, league_id, loser_id))
        
        # Create match record
        db.cursor.execute('''
            INSERT INTO matches (player1_id, player2_id, winner_id, status, league_id)
            VALUES (?, ?, ?, 'completed', ?)
        ''', (interaction.user.id, opponent.id, winner_id, league_id))
        
        db.conn.commit()
        
        # Prepare response message
        msg = f"Match result recorded!\n\n"
        msg += f"Winner: {winner_name} (+{winner_change:.1f} ELO)\n"
        msg += f"Loser: {loser_name} ({loser_change:.1f} ELO)\n"
        
        if league_name:
            msg += f"\nThis match was recorded for league: {league_name}"
        
        await interaction.response.send_message(msg)
        
    except Exception as e:
        error_msg = handle_command_error(interaction, e, "report")
        await interaction.response.send_message(error_msg)
