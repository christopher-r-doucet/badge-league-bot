import os
import sys
import sqlite3
from datetime import datetime
from typing import Optional, Literal
import logging
from dotenv import load_dotenv
import discord
from discord import app_commands, Interaction, File
import math

# Constants
DATABASE_NAME = "league.db"
K_FACTOR = 32  # For ELO calculation
INITIAL_ELO = 1000

# Constants for ELO calculation
BASE_ELO = INITIAL_ELO  # Starting ELO for new players

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
    "Iron": "",
    "Bronze": "",
    "Silver": "",
    "Gold": "",
    "Platinum": "",
    "Diamond": "",
    "Master": "",
    "Grandmaster": ""
}

DEV_MODE = os.getenv('DEV_MODE', 'false').lower() == 'true'
TEST_GUILD_ID = int(os.getenv('TEST_GUILD_ID', '0'))  # Your test server's guild ID

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('discord')
logger.setLevel(logging.INFO)
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
        CREATE TABLE IF NOT EXISTS leagues (
            league_id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS league_players (
            league_id INTEGER,
            player_id INTEGER,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            league_elo REAL DEFAULT 1000.0,
            league_wins INTEGER DEFAULT 0,
            league_losses INTEGER DEFAULT 0,
            PRIMARY KEY (league_id, player_id),
            FOREIGN KEY (league_id) REFERENCES leagues(league_id),
            FOREIGN KEY (player_id) REFERENCES players(discord_id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER,
            player2_id INTEGER,
            winner_id INTEGER,
            league_id INTEGER,
            scheduled_time TEXT,
            status TEXT DEFAULT 'pending',
            elo_change REAL DEFAULT 0.0,
            FOREIGN KEY (player1_id) REFERENCES players(discord_id),
            FOREIGN KEY (player2_id) REFERENCES players(discord_id),
            FOREIGN KEY (winner_id) REFERENCES players(discord_id),
            FOREIGN KEY (league_id) REFERENCES leagues(league_id)
        )
    ''')
    conn.commit()
    print("Database setup complete!")

# Setup bot with required intents
class LeagueBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        
    async def setup_hook(self):
        if DEV_MODE and TEST_GUILD_ID:
            guild = discord.Object(id=TEST_GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        await self.tree.sync()

bot = LeagueBot()

def command_decorator(name: str, description: str, **kwargs):
    """
    Custom decorator that creates both guild and global commands in dev mode,
    but only global commands in production.
    """
    def decorator(func):
        if DEV_MODE and TEST_GUILD_ID:
            # In dev mode, create guild command for instant updates
            bot.tree.command(
                name=name,
                description=description,
                guild=discord.Object(id=TEST_GUILD_ID),
                **kwargs
            )(func)
        # Always create global command
        return bot.tree.command(
            name=name,
            description=description,
            **kwargs
        )(func)
    return decorator

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
    return "Unranked", ""

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    print("------")
    setup_database()
    print("Bot is ready!")

@bot.event
async def on_message(message):
    print(f"Received message: {message.content} from {message.author}")
    if message.author == bot.user:
        return
    
    await bot.process_commands(message)

@bot.event
async def on_command_error(ctx, error):
    print(f"Command error: {error}")
    if isinstance(error, app_commands.CommandNotFound):
        await ctx.response.send_message("Command not found. Use /help for available commands.")
    else:
        await ctx.response.send_message(f"An error occurred: {str(error)}")

@command_decorator(name="register", description="Register as a player")
@app_commands.describe(player_name="Your player name")
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

@command_decorator(name="status", description="Check your current status")
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

@command_decorator(name="matches", description="View your upcoming matches")
async def matches(interaction: Interaction):
    try:
        print(f"Received matches command from {interaction.user}")
        cursor.execute('''
            SELECT 
                players.player_name, matches.scheduled_time, matches.status
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

@command_decorator(name="schedule", description="Schedule a match with another player")
@app_commands.describe(
    opponent="The player to schedule with",
    time="When to play (format: YYYY-MM-DD HH:MM, e.g., 2024-01-01 15:30)"
)
async def schedule(interaction: Interaction, opponent: discord.Member, time: str):
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

@command_decorator(name="schedule_table", description="Display the league schedule in a table format")
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

@command_decorator(name="report", description="Report the result of a match")
@app_commands.describe(
    opponent="The opponent you played against",
    result="Did you win or lose?",
    league_name="The league this match belongs to (optional)"
)
async def report(interaction: Interaction, opponent: discord.Member, result: Literal["win", "loss"], league_name: str = None):
    try:
        print(f"Received report command from {interaction.user}")
        player_id = interaction.user.id
        opponent_id = opponent.id
        
        # Verify both players are registered
        cursor.execute('SELECT * FROM players WHERE discord_id IN (?, ?)', (player_id, opponent_id))
        if len(cursor.fetchall()) != 2:
            await interaction.response.send_message("Both players must be registered first!")
            return

        # If league is specified, verify it exists and both players are in it
        league_id = None
        if league_name:
            cursor.execute('SELECT league_id FROM leagues WHERE league_name = ?', (league_name,))
            league = cursor.fetchone()
            if not league:
                await interaction.response.send_message(f"League '{league_name}' not found!")
                return
            league_id = league[0]
            
            # Check if both players are in the league
            cursor.execute('''
                SELECT COUNT(*) FROM league_players 
                WHERE league_id = ? AND player_id IN (?, ?)
            ''', (league_id, player_id, opponent_id))
            if cursor.fetchone()[0] != 2:
                await interaction.response.send_message("Both players must be members of the specified league!")
                return

        # Get current ratings
        cursor.execute('SELECT elo_rating FROM players WHERE discord_id = ?', (player_id,))
        player_rating = cursor.fetchone()[0]
        cursor.execute('SELECT elo_rating FROM players WHERE discord_id = ?', (opponent_id,))
        opponent_rating = cursor.fetchone()[0]

        # Calculate new ratings
        winner_id = player_id if result == "win" else opponent_id
        loser_id = opponent_id if result == "win" else player_id
        elo_change = calculate_elo_change(
            winner_rating=player_rating if result == "win" else opponent_rating,
            loser_rating=opponent_rating if result == "win" else player_rating
        )

        # Update global ratings and record match
        if result == "win":
            cursor.execute('UPDATE players SET wins = wins + 1, elo_rating = elo_rating + ? WHERE discord_id = ?', (elo_change, player_id))
            cursor.execute('UPDATE players SET losses = losses + 1, elo_rating = elo_rating - ? WHERE discord_id = ?', (elo_change, opponent_id))
        else:
            cursor.execute('UPDATE players SET losses = losses + 1, elo_rating = elo_rating - ? WHERE discord_id = ?', (elo_change, player_id))
            cursor.execute('UPDATE players SET wins = wins + 1, elo_rating = elo_rating + ? WHERE discord_id = ?', (elo_change, opponent_id))

        # Record the match
        cursor.execute('''
            INSERT INTO matches (player1_id, player2_id, winner_id, league_id, status, elo_change)
            VALUES (?, ?, ?, ?, 'completed', ?)
        ''', (player_id, opponent_id, winner_id, league_id, elo_change))

        # If this is a league match, update league-specific stats
        if league_id:
            if result == "win":
                cursor.execute('''
                    UPDATE league_players 
                    SET league_wins = league_wins + 1, 
                        league_elo = league_elo + ? 
                    WHERE league_id = ? AND player_id = ?
                ''', (elo_change, league_id, player_id))
                cursor.execute('''
                    UPDATE league_players 
                    SET league_losses = league_losses + 1, 
                        league_elo = league_elo - ? 
                    WHERE league_id = ? AND player_id = ?
                ''', (elo_change, league_id, opponent_id))
            else:
                cursor.execute('''
                    UPDATE league_players 
                    SET league_losses = league_losses + 1, 
                        league_elo = league_elo - ? 
                    WHERE league_id = ? AND player_id = ?
                ''', (elo_change, league_id, player_id))
                cursor.execute('''
                    UPDATE league_players 
                    SET league_wins = league_wins + 1, 
                        league_elo = league_elo + ? 
                    WHERE league_id = ? AND player_id = ?
                ''', (elo_change, league_id, opponent_id))

        conn.commit()

        # Prepare response message
        response = f"Match result recorded! ELO change: {elo_change:.1f}\n"
        if league_name:
            response += f"League: {league_name}\n"
        
        # Get updated ratings
        cursor.execute('SELECT player_name, elo_rating FROM players WHERE discord_id = ?', (player_id,))
        player = cursor.fetchone()
        cursor.execute('SELECT player_name, elo_rating FROM players WHERE discord_id = ?', (opponent_id,))
        opponent = cursor.fetchone()
        
        response += f"{player[0]}: {player[1]:.1f} ({'+' if result == 'win' else '-'}{elo_change:.1f})\n"
        response += f"{opponent[0]}: {opponent[1]:.1f} ({'-' if result == 'win' else '+'}{elo_change:.1f})"
        
        await interaction.response.send_message(response)
        
    except Exception as e:
        print(f"Error in report command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@command_decorator(name="standings", description="Display the league standings")
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

@command_decorator(name="echo", description="Echoes back your message")
@app_commands.describe(message="The message to echo back")
async def echo(interaction: Interaction, message: str):
    print(f"Received echo command from {interaction.user}")
    await interaction.response.send_message(f"Echo: {message}")

@bot.event
async def on_command_error(ctx, error):
    print(f"Command error: {error}")
    if isinstance(error, app_commands.CommandNotFound):
        await ctx.response.send_message("Command not found. Use /help for available commands.")
    else:
        await ctx.response.send_message(f"An error occurred: {str(error)}")

# League management commands
@command_decorator(name="create_league", description="Create a new league")
@app_commands.describe(league_name="Name of the league to create")
async def create_league(interaction: Interaction, league_name: str):
    try:
        print(f"Received create_league command from {interaction.user}")
        cursor.execute('INSERT INTO leagues (league_name) VALUES (?)', (league_name,))
        conn.commit()
        await interaction.response.send_message(f"Successfully created league: {league_name}")
    except sqlite3.IntegrityError:
        await interaction.response.send_message(f"A league with the name '{league_name}' already exists!")
    except Exception as e:
        print(f"Error in create_league command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@command_decorator(name="join_league", description="Join a league")
@app_commands.describe(league_name="Name of the league to join")
async def join_league(interaction: Interaction, league_name: str):
    try:
        print(f"Received join_league command from {interaction.user}")
        # Check if player is registered
        cursor.execute('SELECT * FROM players WHERE discord_id = ?', (interaction.user.id,))
        if not cursor.fetchone():
            await interaction.response.send_message("You need to register first using /register!")
            return
            
        # Get league ID
        cursor.execute('SELECT league_id FROM leagues WHERE league_name = ?', (league_name,))
        league = cursor.fetchone()
        if not league:
            await interaction.response.send_message(f"League '{league_name}' not found!")
            return
            
        # Add player to league
        try:
            cursor.execute('INSERT INTO league_players (league_id, player_id) VALUES (?, ?)',
                         (league[0], interaction.user.id))
            conn.commit()
            await interaction.response.send_message(f"Successfully joined league: {league_name}")
        except sqlite3.IntegrityError:
            await interaction.response.send_message(f"You are already in league '{league_name}'!")
            
    except Exception as e:
        print(f"Error in join_league command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@command_decorator(name="list_leagues", description="List all available leagues")
async def list_leagues(interaction: Interaction):
    try:
        print(f"Received list_leagues command from {interaction.user}")
        cursor.execute('''
            SELECT 
                l.league_name,
                COUNT(lp.player_id) as player_count
            FROM leagues l
            LEFT JOIN league_players lp ON l.league_id = lp.league_id
            GROUP BY l.league_id, l.league_name
            ORDER BY l.league_name
        ''')
        leagues = cursor.fetchall()
        
        if not leagues:
            await interaction.response.send_message("No leagues exist yet!")
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
        await interaction.response.send_message(table)
        
    except Exception as e:
        print(f"Error in list_leagues command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

@command_decorator(name="league_standings", description="Show standings for a specific league")
@app_commands.describe(league_name="Name of the league to show standings for")
async def league_standings(interaction: Interaction, league_name: str):
    try:
        print(f"Received league_standings command from {interaction.user}")
        cursor.execute('''
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
        players = cursor.fetchall()
        
        if not players:
            await interaction.response.send_message(f"No players found in league '{league_name}'!")
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
        
        await interaction.response.send_message(table + rank_explanation)
        
    except Exception as e:
        print(f"Error in league_standings command: {e}")
        await interaction.response.send_message(f"Error: {str(e)}")

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
