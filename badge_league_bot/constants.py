import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(verbose=True)

# Bot configuration
DEV_MODE = os.getenv('DEV_MODE', 'false').lower() == 'true'
TEST_GUILD_ID = int(os.getenv('TEST_GUILD_ID', '0'))
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')

# Database configuration
DATABASE_NAME = "league.db"

# Game constants
K_FACTOR = 32  # For ELO calculation
INITIAL_ELO = 1000
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
