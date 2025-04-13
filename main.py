import sys
import logging
from badge_league_bot import LeagueBot
from badge_league_bot.constants import DISCORD_TOKEN
from badge_league_bot.commands import *  # This imports all commands

logger = logging.getLogger('discord')

if __name__ == "__main__":
    if not DISCORD_TOKEN:
        logger.error("ERROR: DISCORD_TOKEN not found in environment variables!")
        logger.error("Make sure you have a .env file with DISCORD_TOKEN=your_token_here")
        sys.exit(1)
    else:
        logger.info(f"Discord token found and loaded")

    logger.info("Starting bot...")
    bot.run(DISCORD_TOKEN, log_handler=None)  # Disable default handler as we've set our own
