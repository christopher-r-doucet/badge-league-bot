import { Repository, DataSource } from 'typeorm';
import { League } from '../../entities/League.js';
import { BaseRepository, IBaseRepository } from './base-repository.js';
import { DatabaseConnection } from '../connection.js';

/**
 * League repository interface
 */
export interface ILeagueRepository extends IBaseRepository<League> {
  /**
   * Find leagues by guild ID
   */
  findByGuildId(guildId?: string): Promise<League[]>;
  
  /**
   * Find a league by name and guild ID
   */
  findByNameAndGuildId(name: string, guildId: string): Promise<League | null>;
  
  /**
   * Create a new league
   */
  createLeague(name: string, guildId: string): Promise<League>;
}

/**
 * League repository implementation
 */
export class LeagueRepository extends BaseRepository<League> implements ILeagueRepository {
  private constructor(dataSource: DataSource) {
    super(dataSource.getRepository(League));
  }
  
  /**
   * Create a new league repository instance
   */
  static async create(): Promise<LeagueRepository> {
    const dataSource = await DatabaseConnection.getConnection();
    return new LeagueRepository(dataSource);
  }
  
  /**
   * Find leagues by guild ID
   * If no guild ID is provided, returns all leagues
   */
  async findByGuildId(guildId?: string): Promise<League[]> {
    try {
      console.log('Fetching leagues for guild:', guildId || 'all guilds');
      
      // If guildId is provided, filter leagues by guild
      const whereCondition = guildId ? { guildId } : {};
      
      const leagues = await this.repository.find({
        where: whereCondition
      });
      
      console.log(`Found ${leagues.length} leagues`);
      return leagues;
    } catch (error) {
      console.error('Error getting leagues:', error);
      throw error;
    }
  }
  
  /**
   * Find a league by name and guild ID
   */
  async findByNameAndGuildId(name: string, guildId: string): Promise<League | null> {
    return this.repository.findOne({ 
      where: { 
        name,
        guildId 
      } 
    });
  }
  
  /**
   * Create a new league
   */
  async createLeague(name: string, guildId: string): Promise<League> {
    try {
      console.log('Creating league:', name, 'for guild:', guildId);
      
      // Check if league already exists in this guild
      const existingLeague = await this.findByNameAndGuildId(name, guildId);
      
      if (existingLeague) {
        console.log('League already exists in this guild:', existingLeague);
        throw new Error(`League "${name}" already exists in this server`);
      }

      // Create new league
      const league = this.repository.create({ name, guildId });
      const savedLeague = await this.repository.save(league);
      console.log('Created league:', savedLeague);
      return savedLeague;
    } catch (error) {
      console.error('Error creating league:', error);
      throw error;
    }
  }
}
