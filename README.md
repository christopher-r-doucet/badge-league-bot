# Badge League Bot

A Discord bot for organizing and managing competitive leagues with a visual ranking system. Players earn badges as they climb through the ranks, making competition more engaging and rewarding.

## Features

- **Visual Ranking System**: Custom badges for each rank tier (Bronze, Silver, Gold, Diamond, Master, Grandmaster)
- **ELO Rating**: Competitive matchmaking using ELO rating system
- **League Management**: Create and manage multiple leagues
- **Leaderboard**: Visual standings display with rank badges
- **Interactive UI**: Rich embeds and interactive buttons for better user experience
- **Autocomplete**: Smart suggestions when typing league names

## Recent Updates

- **Database Layer Refactoring**: Implemented repository pattern for improved maintainability and separation of concerns
- **Player Identification Fix**: Fixed the `/my_matches` command to display opponent usernames instead of Discord IDs
- **Match Reporting Improvements**: Updated the `/report_result` command to correctly identify participants across multiple leagues
- **Match Cancellation Enhancement**: Improved validation for player participation in match cancellation
- **Error Handling**: Added robust error handling and fallbacks for missing player data

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
- `/schedule_match` - Schedule a match with another player
- `/my_matches` - View your upcoming and completed matches
- `/report_result` - Report the result of a completed match
- `/view_matches` - View all matches in a league
- `/cancel_match` - Cancel a match you scheduled

## Development

This bot is built with:
- TypeScript
- discord.js v14
- TypeORM with SQLite

### Architecture

The bot follows a clean architecture pattern with the following components:

#### Database Layer
- **Repository Pattern**: Each entity (League, Player, Match, UserPreference) has its own repository
- **Base Repository**: Common CRUD operations are standardized in a base repository
- **Service Layer**: Business logic is encapsulated in service classes
- **Facade Pattern**: A database facade provides a unified interface and backward compatibility

```
src/
├── database/
│   ├── connection.ts           # Database connection management
│   ├── index-new-complete.ts   # Database facade
│   ├── repositories/           # Data access layer
│   │   ├── base-repository.ts  # Base repository interface and implementation
│   │   ├── league-repository.ts
│   │   ├── match-repository.ts
│   │   ├── player-repository.ts
│   │   └── user-preference-repository.ts
│   └── services/               # Business logic layer
│       ├── league-service.ts
│       ├── match-service.ts
│       ├── player-service.ts
│       └── user-preference-service.ts
├── entities/                   # TypeORM entities
│   ├── League.ts
│   ├── Match.ts
│   ├── Player.ts
│   └── UserPreference.ts
└── commands/                   # Discord slash commands
    ├── index.ts
    ├── league.ts
    ├── match.ts
    └── player.ts
```

### Ranking System

The bot uses a competitive ranking system with the following tiers:

1. **Bronze**: Default starting rank, below 1400 ELO
2. **Silver**: 1400-1599 ELO
3. **Gold**: 1600-1799 ELO
4. **Diamond**: 1800-1999 ELO
5. **Master**: 2000-2199 ELO
6. **Grandmaster**: Exclusive rank for players with 2200+ ELO

The Grandmaster rank is special - only one player per league can hold it at a time. The player with the highest ELO (minimum 2200) in each league gets the Grandmaster title. If someone surpasses the current Grandmaster, they claim the title and the former Grandmaster is demoted to Master.

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
