import discord
from discord import app_commands
import logging
from .constants import DEV_MODE, TEST_GUILD_ID

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('discord')
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s:%(levelname)s:%(name)s: %(message)s'))
logger.addHandler(handler)

class LeagueBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        
    async def setup_hook(self):
        """This is called when the bot starts, sets up the command tree"""
        logger.info("Setting up command tree...")
        if DEV_MODE and TEST_GUILD_ID:
            logger.info(f"Development mode: Syncing commands to test guild {TEST_GUILD_ID}")
            guild = discord.Object(id=TEST_GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            logger.info("Guild command sync complete!")
        else:
            logger.info("Production mode: Syncing global commands")
            await self.tree.sync()
            logger.info("Global command sync complete!")

    async def on_ready(self):
        """Called when the bot is ready to start receiving events"""
        logger.info(f"Logged in as {self.user} (ID: {self.user.id})")
        logger.info("------")

def command_decorator(name: str, description: str, **kwargs):
    """
    Custom decorator that creates either guild commands in dev mode,
    or global commands in production.
    """
    def decorator(func):
        if DEV_MODE and TEST_GUILD_ID:
            # In dev mode, create guild command for instant updates
            return bot.tree.command(
                name=name,
                description=description,
                guild=discord.Object(id=TEST_GUILD_ID),
                **kwargs
            )(func)
        else:
            # In production, create global command
            return bot.tree.command(
                name=name,
                description=description,
                **kwargs
            )(func)
    return decorator

# Create bot instance
bot = LeagueBot()
