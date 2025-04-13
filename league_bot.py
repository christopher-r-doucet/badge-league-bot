import os
import sys
import sqlite3
from datetime import datetime
from typing import Optional
import logging
from dotenv import load_dotenv
import discord
from discord.ext import commands
from discord import app_commands, Interaction, File
from config import DATABASE_NAME
import math

# Constants for ELO calculation
K_FACTOR = 32  # How much each match affects rating
BASE_ELO = 1000  # Starting ELO for new players

# Rank tiers and their ELO ranges
RANKS = {
    "Iron": (0, 899),
    "Bronze": (900, 1199),
    "Silver": (1200, 1499),
    "Gold": (1500, 1799),
    "Platinum": (1800, 2099),
    "Diamond": (2100, 2399),
    "Master": (2400, 2699),
    "Grandmaster": (2700, float('inf'))
}

# Badge file paths
BADGE_PATHS = {
    "Bronze": "badges/bronze.png",
    "Silver": "badges/silver.png",
    "Gold": "badges/gold.png",
    "Diamond": "badges/diamond.png",
    "Master": "badges/master.png",
    "Grandmaster": "badges/grandmaster.png"
}

# Rank Emojis (fallback for when images can't be sent)
RANK_EMOJIS = {
    "Iron": "🔩",
    "Bronze": "🥉",
    "Silver": "🥈",
    "Gold": "🥇",
    "Platinum": "💎",
    "Diamond": "💠",
    "Master": "👑",
    "Grandmaster": "🏆"
}

def calculate_elo_change(winner_elo: float, loser_elo: float) -> tuple[float, float]:
    """Calculate ELO changes after a match."""
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    expected_loser = 1 - expected_winner
    
    winner_change = K_FACTOR * (1 - expected_winner)
    loser_change = K_FACTOR * (0 - expected_loser)
    
    return winner_change, loser_change

def get_rank(elo: float) -> tuple[str, str]:
    """Get rank name and emoji based on ELO."""
    for rank, (min_elo, max_elo) in RANKS.items():
        if min_elo <= elo <= max_elo:
            return rank, RANK_EMOJIS[rank]
    return "Unranked", "❓"

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('discord')
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s:%(levelname)s:%(name)s: %(message)s'))
logger.addHandler(handler)

print("Current working directory:", os.getcwd())
print("Loading environment variables...")
load_dotenv(verbose=True)

# Initialize database
conn = sqlite3.connect(DATABASE_NAME)
cursor = conn.cursor()

def setup_database():
    print("Setting up database...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS players (
            discord_id INTEGER PRIMARY KEY,
            player_name TEXT NOT NULL,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            elo_rating REAL DEFAULT 1000.0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER,
            player2_id INTEGER,
            winner_id INTEGER,
            scheduled_time TEXT,
            status TEXT DEFAULT 'pending',
            elo_change REAL DEFAULT 0.0,
            FOREIGN KEY (player1_id) REFERENCES players(discord_id),
            FOREIGN KEY (player2_id) REFERENCES players(discord_id),
            FOREIGN KEY (winner_id) REFERENCES players(discord_id)
        )
    ''')
    conn.commit()
    print("Database setup complete")

# Setup bot with required intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.guilds = True
intents.messages = True
intents.reactions = True
intents.presences = True
bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name} ({bot.user.id})')
    setup_database()
    try:
        print("Syncing commands globally...")
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
        for command in synced:
            print(f"- Synced command: {command.name}")
    except Exception as e:
        print(f"Error syncing commands: {e}")

@bot.event
async def on_message(message):
    print(f"Received message: {message.content} from {message.author}")
    if message.author == bot.user:
        return
    
    await bot.process_commands(message)

@bot.event
async def on_command_error(ctx, error):
    print(f"Command error: {error}")
    if isinstance(error, commands.CommandNotFound):
        await ctx.send("Command not found. Use !help for available commands.")
    else:
        await ctx.send(f"An error occurred: {str(error)}")

@bot.tree.command(name="register", description="Register as a player in the league")
@app_commands.describe(player_name="Your in-game name")
async def register(interaction: Interaction, player_name: str):
    try:
        print(f"Received register command from {interaction.user}")
        cursor.execute('SELECT * FROM players WHERE discord_id = ?', (interaction.user.id,))
        existing = cursor.fetchone()
        
        if existing:
            await interaction.response.send_message("You are already registered!")
            return
        
        cursor.execute('INSERT INTO players (discord_id, player_name, elo_rating) VALUES (?, ?, ?)',
                      (interaction.user.id, player_name, BASE_ELO))
        conn.commit()
        await interaction.response.send_message(f"Successfully registered as {player_name}!")
    except Exception as e:
        print(f"Error in register command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="schedule", description="Schedule a match with another player")
@app_commands.describe(opponent="The player you want to challenge", time="Time for the match (YYYY-MM-DD HH:MM)")
async def schedule(interaction: Interaction, opponent: str, time: str):
    try:
        print(f"Received schedule command from {interaction.user}")
        cursor.execute('SELECT discord_id FROM players WHERE player_name = ?', (opponent,))
        opponent_id = cursor.fetchone()
        
        if not opponent_id:
            await interaction.response.send_message(f"Player {opponent} is not registered!")
            return
        
        try:
            datetime.strptime(time, '%Y-%m-%d %H:%M')
        except ValueError:
            await interaction.response.send_message("Invalid time format! Use YYYY-MM-DD HH:MM")
            return
        
        cursor.execute('INSERT INTO matches (player1_id, player2_id, scheduled_time) VALUES (?, ?, ?)',
                      (interaction.user.id, opponent_id[0], time))
        conn.commit()
        await interaction.response.send_message(f"Match scheduled with {opponent} at {time}")
    except Exception as e:
        print(f"Error in schedule command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="status", description="View your current standings")
async def status(interaction: Interaction):
    try:
        print(f"Received status command from {interaction.user}")
        cursor.execute('''
            SELECT wins, losses, elo_rating FROM players WHERE discord_id = ?
        ''', (interaction.user.id,))
        result = cursor.fetchone()
        
        if not result:
            await interaction.response.send_message("You are not registered. Use /register first!")
            return
        
        wins, losses, elo_rating = result
        rank, rank_emoji = get_rank(elo_rating)
        await interaction.response.send_message(f"Your record: {wins} wins, {losses} losses, ELO: {elo_rating} ({rank} {rank_emoji})")
    except Exception as e:
        print(f"Error in status command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="matches", description="View upcoming matches")
async def matches(interaction: Interaction):
    try:
        print(f"Received matches command from {interaction.user}")
        cursor.execute('''
            SELECT players.player_name, matches.scheduled_time, matches.status
            FROM matches
            JOIN players ON players.discord_id = matches.player1_id
            WHERE matches.status = 'pending'
            ORDER BY matches.scheduled_time
        ''')
        matches = cursor.fetchall()
        
        if not matches:
            await interaction.response.send_message("No upcoming matches!")
            return
        
        message = "Upcoming matches:\n"
        for match in matches:
            message += f"{match[0]} vs ? at {match[1]} - {match[2]}\n"
        
        await interaction.response.send_message(message)
    except Exception as e:
        print(f"Error in matches command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="report", description="Report match results")
@app_commands.describe(opponent="The player you played against", result="Did you win? (yes/no)")
async def report(interaction: Interaction, opponent: str, result: str):
    try:
        print(f"Received report command from {interaction.user}")
        if result.lower() not in ['yes', 'no']:
            await interaction.response.send_message("Result must be 'yes' or 'no'")
            return
        
        cursor.execute('SELECT discord_id FROM players WHERE player_name = ?', (opponent,))
        opponent_id = cursor.fetchone()
        
        if not opponent_id:
            await interaction.response.send_message(f"Player {opponent} is not registered!")
            return
        
        cursor.execute('''
            UPDATE matches
            SET status = 'completed', winner_id = ?
            WHERE player1_id = ? AND player2_id = ? AND status = 'pending'
            ORDER BY match_id DESC
            LIMIT 1
        ''', (interaction.user.id if result.lower() == 'yes' else opponent_id[0],
              interaction.user.id, opponent_id[0]))
        
        if cursor.rowcount == 0:
            await interaction.response.send_message("No pending match found with this opponent")
            return
        
        # Get ELO ratings
        cursor.execute('SELECT elo_rating FROM players WHERE discord_id = ?', (interaction.user.id,))
        user_elo = cursor.fetchone()[0]
        cursor.execute('SELECT elo_rating FROM players WHERE discord_id = ?', (opponent_id[0],))
        opponent_elo = cursor.fetchone()[0]
        
        # Calculate ELO changes
        winner_elo = user_elo if result.lower() == 'yes' else opponent_elo
        loser_elo = opponent_elo if result.lower() == 'yes' else user_elo
        winner_change, loser_change = calculate_elo_change(winner_elo, loser_elo)
        
        # Update ELO ratings
        cursor.execute('UPDATE players SET elo_rating = elo_rating + ? WHERE discord_id = ?', (winner_change, interaction.user.id if result.lower() == 'yes' else opponent_id[0]))
        cursor.execute('UPDATE players SET elo_rating = elo_rating + ? WHERE discord_id = ?', (loser_change, interaction.user.id if result.lower() == 'no' else opponent_id[0]))
        
        # Update player stats
        cursor.execute('''
            UPDATE players
            SET wins = wins + 1
            WHERE discord_id = ?
        ''', (interaction.user.id if result.lower() == 'yes' else opponent_id[0],))
        
        cursor.execute('''
            UPDATE players
            SET losses = losses + 1
            WHERE discord_id = ?
        ''', (interaction.user.id if result.lower() == 'no' else opponent_id[0],))
        
        # Update match ELO change
        cursor.execute('UPDATE matches SET elo_change = ? WHERE match_id = (SELECT match_id FROM matches WHERE player1_id = ? AND player2_id = ? AND status = ? ORDER BY match_id DESC LIMIT 1)', (winner_change, interaction.user.id, opponent_id[0], 'completed'))
        
        conn.commit()
        await interaction.response.send_message("Match results reported successfully!")
    except Exception as e:
        print(f"Error in report command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="schedule_table", description="Display the league schedule in a table format")
async def schedule_table(interaction: Interaction):
    try:
        print(f"Received schedule_table command from {interaction.user}")
        cursor.execute('''
            SELECT 
                p1.player_name as player1,
                p2.player_name as player2,
                m.scheduled_time,
                m.status
            FROM matches m
            JOIN players p1 ON m.player1_id = p1.discord_id
            JOIN players p2 ON m.player2_id = p2.discord_id
            ORDER BY 
                CASE m.status
                    WHEN 'pending' THEN 1
                    WHEN 'completed' THEN 2
                    ELSE 3
                END,
                m.scheduled_time
        ''')
        matches = cursor.fetchall()
        
        if not matches:
            await interaction.response.send_message("No matches scheduled yet!")
            return
            
        # Create table header
        table = "```\n"
        table += "League Schedule\n"
        table += "=" * 50 + "\n"
        table += f"{'Player 1':<15} {'Player 2':<15} {'Time':<15} {'Status':<10}\n"
        table += "-" * 50 + "\n"
        
        # Add each match to the table
        for match in matches:
            player1, player2, time, status = match
            table += f"{player1:<15} {player2:<15} {time:<15} {status:<10}\n"
        
        table += "```"
        
        await interaction.response.send_message(table)
        
    except Exception as e:
        print(f"Error in schedule_table command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="standings", description="Display the league standings")
async def standings(interaction: Interaction):
    try:
        print(f"Received standings command from {interaction.user}")
        cursor.execute('''
            SELECT 
                player_name,
                wins,
                losses,
                elo_rating
            FROM players
            ORDER BY elo_rating DESC
        ''')
        players = cursor.fetchall()
        
        if not players:
            await interaction.response.send_message("No players registered yet!")
            return
            
        # Create table header
        table = "```\n"
        table += "League Standings\n"
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
        
        # Create a list of files to send
        files = []
        # Add explanation of ranks with badge images
        rank_explanation = "\nRank Tiers:\n"
        for rank, (min_elo, max_elo) in RANKS.items():
            emoji = RANK_EMOJIS[rank]
            rank_explanation += f"{emoji} {rank}: {min_elo}-{max_elo} ELO\n"
            
            # Add badge file if available
            if rank in BADGE_PATHS and os.path.exists(BADGE_PATHS[rank]):
                files.append(File(BADGE_PATHS[rank], filename=f"{rank.lower()}_badge.png"))
        
        await interaction.response.send_message(table + rank_explanation, files=files)
        
    except Exception as e:
        print(f"Error in standings command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@bot.tree.command(name="echo", description="Echoes back your message")
@app_commands.describe(message="The message to echo back")
async def echo(interaction: Interaction, message: str):
    print(f"Received echo command from {interaction.user}")
    await interaction.response.send_message(f"Echo: {message}")

@bot.command(name="test")
async def test(ctx):
    print(f"Received test command from {ctx.author}")
    await ctx.send("Bot is alive!")

# Run the bot
if __name__ == "__main__":
    token = os.getenv('DISCORD_TOKEN')
    if not token:
        print("ERROR: DISCORD_TOKEN not found in environment variables!")
        print("Make sure you have a .env file with DISCORD_TOKEN=your_token_here")
        sys.exit(1)
    else:
        print(f"Token found (first 5 chars): {token[:5]}...")

    print("Starting bot...")
    bot.run(token)
