import sqlite3
from ..constants import DATABASE_NAME

class Database:
    def __init__(self):
        self.conn = sqlite3.connect(DATABASE_NAME)
        self.cursor = self.conn.cursor()
        self.setup_database()
        
    def setup_database(self):
        """Initialize the database schema"""
        print("Setting up database...")
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS players (
                discord_id INTEGER PRIMARY KEY,
                player_name TEXT NOT NULL,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                elo_rating REAL DEFAULT 1000.0
            )
        ''')
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS leagues (
                league_id INTEGER PRIMARY KEY AUTOINCREMENT,
                league_name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.cursor.execute('''
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
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS matches (
                match_id INTEGER PRIMARY KEY AUTOINCREMENT,
                player1_id INTEGER,
                player2_id INTEGER,
                scheduled_time TEXT,
                status TEXT DEFAULT 'pending',
                winner_id INTEGER,
                league_id INTEGER,
                FOREIGN KEY (player1_id) REFERENCES players(discord_id),
                FOREIGN KEY (player2_id) REFERENCES players(discord_id),
                FOREIGN KEY (winner_id) REFERENCES players(discord_id),
                FOREIGN KEY (league_id) REFERENCES leagues(league_id)
            )
        ''')
        self.conn.commit()
        print("Database setup complete!")

    def close(self):
        """Close the database connection"""
        self.conn.close()

# Global database instance
db = Database()
