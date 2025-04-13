import sqlite3
import logging
from ..constants import DATABASE_NAME

logger = logging.getLogger('discord')

class Database:
    def __init__(self):
        self._conn = None
        self._cursor = None
        self.setup_database()
        
    @property
    def conn(self):
        """Get the database connection, creating it if necessary"""
        if self._conn is None:
            logger.info("Creating new database connection")
            self._conn = sqlite3.connect(DATABASE_NAME, timeout=20.0)  # 20 second timeout
            self._conn.row_factory = sqlite3.Row
        return self._conn

    @property
    def cursor(self):
        """Get the database cursor, creating it if necessary"""
        if self._cursor is None or self._conn is None:
            self._cursor = self.conn.cursor()
        return self._cursor

    def close(self):
        """Close the database connection"""
        if self._cursor:
            self._cursor.close()
            self._cursor = None
        if self._conn:
            self._conn.close()
            self._conn = None

    def commit(self):
        """Commit the current transaction"""
        if self._conn:
            self._conn.commit()

    def setup_database(self):
        """Initialize the database schema"""
        logger.info("Setting up database...")
        try:
            # Enable foreign keys
            self.cursor.execute("PRAGMA foreign_keys = ON")
            
            # Create tables with better indexing
            self.cursor.execute('''
                CREATE TABLE IF NOT EXISTS players (
                    discord_id INTEGER PRIMARY KEY,
                    player_name TEXT NOT NULL,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    elo_rating REAL DEFAULT 1000.0
                )
            ''')
            
            # Add index for player lookup
            self.cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_player_name 
                ON players(player_name)
            ''')

            self.cursor.execute('''
                CREATE TABLE IF NOT EXISTS leagues (
                    league_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    league_name TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Add index for league lookup
            self.cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_league_name 
                ON leagues(league_name)
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (player1_id) REFERENCES players(discord_id),
                    FOREIGN KEY (player2_id) REFERENCES players(discord_id),
                    FOREIGN KEY (winner_id) REFERENCES players(discord_id),
                    FOREIGN KEY (league_id) REFERENCES leagues(league_id)
                )
            ''')
            
            # Add indexes for match lookups
            self.cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_match_players 
                ON matches(player1_id, player2_id)
            ''')
            self.cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_match_league 
                ON matches(league_id)
            ''')

            self.commit()
            logger.info("Database setup complete!")
            
        except sqlite3.Error as e:
            logger.error(f"Database setup error: {str(e)}", exc_info=e)
            raise

    def __del__(self):
        """Ensure connection is closed when object is destroyed"""
        self.close()

# Global database instance
db = Database()
