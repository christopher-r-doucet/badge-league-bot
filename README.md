# Badge League Bot

<<<<<<< HEAD
A Discord bot for organizing and managing 1v1 competitive matches with a visual ranking system. Players earn badges as they climb through the ranks, making competition more engaging and rewarding.

## Setup Instructions

1. **Create a Discord Bot Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Give your bot a name (e.g., "LeagueBot")
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
   ```
   Replace `your_token_here` with the token you copied from Discord Developer Portal.

4. **Run the Bot**
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Features

- **Visual Ranking System**: Custom badges for each rank tier (Bronze, Silver, Gold, Diamond, Master, Grandmaster)
- **ELO Rating**: Competitive matchmaking using ELO rating system
- **League Management**: Create and manage multiple leagues
- **Leaderboard**: Visual standings display with rank badges
=======
A Discord bot for managing competitive leagues with badge/rank progression, written in TypeScript using discord.js.

## Features

- Create and manage leagues
- Track player rankings and ELO
- Automatic badge/rank progression
- Match reporting and scheduling

## Setup

1. Install dependencies:
```bash
npm install
```
>>>>>>> 1a6312a (switch to typescript)

2. Create a `.env.local` file with your Discord bot token:
```
DISCORD_TOKEN=your_token_here
```

<<<<<<< HEAD
- `/create_league <name>` - Create a new league
- `/join_league <name>` - Join an existing league
- `/list_leagues` - View all available leagues
- `/league_standings <name>` - View standings for a specific league

## Development

This bot is built with:
- TypeScript
- discord.js
- TypeORM with SQLite

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
=======
3. Build the TypeScript code:
```bash
npm run build
```

4. Start the bot:
```bash
npm start
```

## Commands

- `/create_league` - Create a new league
- `/join_league` - Join an existing league
- `/list_leagues` - Show all available leagues
- `/league_standings` - View standings for a specific league

## Development

To run in development mode with auto-reloading:
```bash
npm run dev
```

## License

MIT
>>>>>>> 1a6312a (switch to typescript)
