import { Repository, DataSource } from 'typeorm';
import { UserPreference } from '../../entities/UserPreference.js';
import { BaseRepository, IBaseRepository } from './base-repository.js';
import { DatabaseConnection } from '../connection.js';

/**
 * UserPreference repository interface
 */
export interface IUserPreferenceRepository extends IBaseRepository<UserPreference> {
  /**
   * Find user preference by Discord ID and guild ID
   */
  findByDiscordIdAndGuildId(discordId: string, guildId?: string): Promise<UserPreference | null>;
  
  /**
   * Set default league for a user
   */
  setDefaultLeague(discordId: string, leagueId: string, guildId?: string): Promise<UserPreference>;
}

/**
 * UserPreference repository implementation
 */
export class UserPreferenceRepository extends BaseRepository<UserPreference> implements IUserPreferenceRepository {
  private constructor(dataSource: DataSource) {
    super(dataSource.getRepository(UserPreference));
  }
  
  /**
   * Create a new user preference repository instance
   */
  static async create(): Promise<UserPreferenceRepository> {
    const dataSource = await DatabaseConnection.getConnection();
    return new UserPreferenceRepository(dataSource);
  }
  
  /**
   * Find user preference by Discord ID and guild ID
   */
  async findByDiscordIdAndGuildId(discordId: string, guildId?: string): Promise<UserPreference | null> {
    const whereClause: any = { discordId };
    if (guildId) {
      whereClause.guildId = guildId;
    }
    
    return this.repository.findOne({
      where: whereClause
    });
  }
  
  /**
   * Set default league for a user
   */
  async setDefaultLeague(discordId: string, leagueId: string, guildId?: string): Promise<UserPreference> {
    try {
      // Find existing preference
      const whereClause: any = { discordId };
      if (guildId) {
        whereClause.guildId = guildId;
      }
      
      let preference = await this.repository.findOne({
        where: whereClause
      });
      
      // Create or update preference
      if (!preference) {
        preference = new UserPreference();
        preference.discordId = discordId;
        if (guildId) {
          preference.guildId = guildId;
        } else {
          preference.guildId = null as any; // TypeORM will handle this correctly
        }
      }
      
      preference.defaultLeagueId = leagueId;
      
      return await this.repository.save(preference);
    } catch (error) {
      console.error('Error setting default league:', error);
      throw error;
    }
  }
}
