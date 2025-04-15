import { DataSource } from 'typeorm';
import { League } from '../entities/League.js';
import { Player } from '../entities/Player.js';
import { Match, MatchStatus } from '../entities/Match.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigration() {
  console.log('Starting migration to add guildId to leagues...');
  
  // Create a database connection
  let dataSource: DataSource;
  
  // In production (Heroku), use DATABASE_URL if available
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DATABASE_URL) {
      console.log('Using PostgreSQL database from DATABASE_URL');
      
      // Parse the DATABASE_URL to extract connection details
      const databaseUrl = process.env.DATABASE_URL;
      console.log(`Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Log URL with password hidden
      
      dataSource = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        ssl: {
          rejectUnauthorized: false
        },
        synchronize: false, // Important: don't auto-synchronize during migration
        entities: [League, Player, Match],
        logging: ['error', 'warn', 'info']
      });
    } else {
      throw new Error('DATABASE_URL not found in environment variables');
    }
  } else {
    // Development environment - use SQLite
    dataSource = new DataSource({
      type: 'sqlite',
      database: 'league.db',
      synchronize: false, // Important: don't auto-synchronize during migration
      entities: [League, Player, Match],
      logging: ['error', 'warn', 'info']
    });
  }
  
  try {
    // Initialize the connection
    await dataSource.initialize();
    console.log('Database connection initialized');
    
    // Get the league repository
    const leagueRepository = dataSource.getRepository(League);
    
    // Get all leagues
    const leagues = await leagueRepository.find();
    console.log(`Found ${leagues.length} leagues to update`);
    
    // Default guild ID to use for existing leagues
    // You might want to customize this based on your needs
    const defaultGuildId = process.env.DEFAULT_GUILD_ID || '0';
    
    // Update each league with the default guild ID
    for (const league of leagues) {
      if (!league.guildId) {
        league.guildId = defaultGuildId;
        await leagueRepository.save(league);
        console.log(`Updated league ${league.name} with guild ID ${defaultGuildId}`);
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close the connection
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
