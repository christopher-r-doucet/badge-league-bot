# Badge League Bot

A Discord bot for organizing and managing competitive leagues with a visual ranking system. Players earn badges as they climb through the ranks, making competition more engaging and rewarding.

## Features

- **Visual Ranking System**: Custom badges for each rank tier (Bronze, Silver, Gold, Diamond, Master, Grandmaster)
- **ELO Rating**: Competitive matchmaking using ELO rating system
- **League Management**: Create and manage multiple leagues
- **Leaderboard**: Visual standings display with rank badges
- **Interactive UI**: Rich embeds and interactive buttons for better user experience
- **Autocomplete**: Smart suggestions when typing league names

## Setup Instructions

1. **Create a Discord Bot Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Give your bot a name (e.g., "Badge League Bot")
   - Click "Bot" in the sidebar and then "Add Bot"
   - Copy the Token

2. **Install Required Packages**
   ```bash
   npm install
   ```

3. **Create .env.local File**
   Create a file named `.env.local` in the same directory as the bot file and add:
   ```
   DISCORD_TOKEN=your_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   ```
   Replace with your actual values from the Discord Developer Portal.

4. **Deploy Commands**
   ```bash
   # Development (guild-specific commands - updates instantly)
   npm run deploy-commands:dev
   
   # Clean up duplicate commands if needed
   npm run deploy-commands:cleanup
   
   # Production (global commands - may take up to an hour to update)
   npm run deploy-commands:prod
   ```

   > **Important**: Only use global commands in production. For development, always use guild-specific commands to avoid duplicates and for faster updates.

5. **Run the Bot**
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Commands

- `/create_league` - Create a new league with a custom name
- `/join_league` - Join an existing league (with autocomplete)
- `/list_leagues` - View all available leagues with player counts
- `/league_standings` - View standings for a specific league with rank badges
- `/invite_to_league` - Invite a player to join your league with a clickable button
- `/status` - Check your current rank, ELO, wins, losses, and badge
- `/help` - Display help information about the bot and available commands

## Development

This bot is built with:
- TypeScript
- discord.js v14
- TypeORM with SQLite

### Local Development

To prevent "Interaction has already been acknowledged" errors:
1. During local development:
   - Scale down Heroku worker to 0: `heroku ps:scale worker=0 -a badge-league-bot`
   - Run bot locally with `npm run dev`

2. For production:
   - Push changes to main branch
   - Scale up Heroku worker to 1: `heroku ps:scale worker=1 -a badge-league-bot`

This prevents multiple bot instances from trying to handle the same interactions.

## Deployment

The bot is deployed on Heroku:

1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. Deploy to Heroku:
   ```bash
   git push heroku main
   heroku ps:scale worker=1 -a badge-league-bot
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
