import { DataSource } from 'typeorm';
import { League } from '../entities/League.js';
import { Player } from '../entities/Player.js';
import { Match } from '../entities/Match.js';
import { UserPreference } from '../entities/UserPreference.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Manages database connection and initialization
 */
export class DatabaseConnection {
  private static instance: DataSource;

  /**
   * Get the database connection instance
   * Creates a new connection if one doesn't exist
   */
  static async getConnection(): Promise<DataSource> {
    if (!this.instance || !this.instance.isInitialized) {
      this.instance = await this.createConnection();
      await this.initializeDatabase();
    }
    return this.instance;
  }

  /**
   * Create a new database connection
   */
  private static createConnection(): DataSource {
    // Determine database path based on environment
    let dbPath = 'league.db';
    
    // In production (Heroku), use DATABASE_URL if available
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DATABASE_URL) {
        console.log('Using PostgreSQL database from DATABASE_URL');
        
        // Parse the DATABASE_URL to extract connection details
        const databaseUrl = process.env.DATABASE_URL;
        console.log(`Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Log URL with password hidden
        
        return new DataSource({
          type: 'postgres',
          url: databaseUrl,
          ssl: {
            rejectUnauthorized: false
          },
          synchronize: true,
          entities: [League, Player, Match, UserPreference],
          logging: ['error', 'warn', 'schema']
        });
      } else {
        // Fallback to SQLite in a more persistent location
        const dataDir = process.env.DATA_DIR || '/app/data';
        try {
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          dbPath = path.join(dataDir, 'league.db');
          console.log(`Using database path: ${dbPath}`);
        } catch (error) {
          console.error('Error creating data directory:', error);
          // Fallback to current directory
          dbPath = 'league.db';
          console.log(`Falling back to database path: ${dbPath}`);
        }
      }
    } else {
      console.log(`Using development database path: ${dbPath}`);
    }
    
    return new DataSource({
      type: 'sqlite',
      database: dbPath,
      synchronize: true,
      entities: [League, Player, Match, UserPreference],
      logging: ['error', 'warn', 'schema']
    });
  }

  /**
   * Initialize the database with any required setup
   */
  private static async initializeDatabase(): Promise<void> {
    try {
      await this.instance.initialize();
      console.log('Database initialized successfully');
      
      // Log some diagnostic information
      const leagueRepository = this.instance.getRepository(League);
      const leagues = await leagueRepository.find();
      console.log(`Found ${leagues.length} leagues in database`);
      
      // Create a test league if none exist and we're in development
      if (leagues.length === 0 && process.env.NODE_ENV === 'development') {
        console.log('Creating a test league...');
        const testLeague = new League();
        testLeague.name = 'Test League';
        testLeague.createdAt = new Date();
        await leagueRepository.save(testLeague);
        console.log('Test league created');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
}
