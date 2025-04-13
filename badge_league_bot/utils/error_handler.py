import sqlite3
import logging
from discord import app_commands, Interaction

logger = logging.getLogger('discord')

def handle_command_error(interaction: Interaction, error: Exception, command_name: str) -> str:
    """
    Handle command errors and return appropriate error messages
    """
    error_msg = f"Error in {command_name}: "
    
    if isinstance(error, app_commands.errors.CommandInvokeError):
        error = error.original
    
    if isinstance(error, sqlite3.IntegrityError):
        if "UNIQUE constraint failed" in str(error):
            error_msg += "This record already exists."
        else:
            error_msg += "Database constraint violation."
    elif isinstance(error, sqlite3.OperationalError):
        error_msg += "Database operation failed. The database might be locked or corrupted."
    elif isinstance(error, ValueError):
        error_msg += str(error)
    else:
        error_msg += f"An unexpected error occurred: {str(error)}"
    
    logger.error(f"{error_msg}\nFull traceback:", exc_info=error)
    return error_msg
