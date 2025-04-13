import discord
from discord import app_commands, Interaction
import logging
import asyncio
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
        
        # Set up error handling for all commands
        self.tree.on_error = self.on_command_error
        
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

    async def on_command_error(self, interaction: Interaction, error: app_commands.AppCommandError):
        """Global error handler for all command errors"""
        logger.error(f"Error in command {interaction.command.name}: {str(error)}", exc_info=error)
        
        try:
            if interaction.response.is_done():
                # If we already sent a response, edit it
                await interaction.edit_original_response(
                    content=f"Error: {str(error)}"
                )
            else:
                # Send a new response
                await interaction.response.send_message(
                    content=f"Error: {str(error)}",
                    ephemeral=True
                )
        except (discord.NotFound, discord.Forbidden) as e:
            logger.error(f"Could not send error message: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error while handling command error: {str(e)}", exc_info=e)

def command_decorator(name: str, description: str, **kwargs):
    """
    Custom decorator that creates either guild commands in dev mode,
    or global commands in production.
    """
    def decorator(func):
        async def wrapper(interaction: Interaction, *args, **kwargs):
            try:
                # Set a timeout for the command execution
                return await asyncio.wait_for(func(interaction, *args, **kwargs), timeout=2.5)
            except asyncio.TimeoutError:
                logger.error(f"Command {name} timed out")
                if not interaction.response.is_done():
                    await interaction.response.send_message(
                        "Command timed out. Please try again.",
                        ephemeral=True
                    )
            except Exception as e:
                logger.error(f"Error in command {name}: {str(e)}", exc_info=e)
                if not interaction.response.is_done():
                    await interaction.response.send_message(
                        f"An error occurred: {str(e)}",
                        ephemeral=True
                    )
                raise

        # Apply the command decorator
        if DEV_MODE and TEST_GUILD_ID:
            # In dev mode, create guild command for instant updates
            return bot.tree.command(
                name=name,
                description=description,
                guild=discord.Object(id=TEST_GUILD_ID),
                **kwargs
            )(wrapper)
        else:
            # In production, create global command
            return bot.tree.command(
                name=name,
                description=description,
                **kwargs
            )(wrapper)
    return decorator

# Create bot instance
bot = LeagueBot()
