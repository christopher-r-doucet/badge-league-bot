import { UserPreference } from '../../entities/UserPreference.js';
import { IUserPreferenceRepository, UserPreferenceRepository } from '../repositories/user-preference-repository.js';
import { ILeagueRepository, LeagueRepository } from '../repositories/league-repository.js';

/**
 * UserPreference service interface
 */
export interface IUserPreferenceService {
  /**
   * Get user preference by Discord ID and guild ID
   */
  getUserPreference(discordId: string, guildId?: string): Promise<UserPreference | null>;
  
  /**
   * Set default league for a user
   */
  setDefaultLeague(discordId: string, leagueName: string, guildId?: string): Promise<UserPreference>;
  
  /**
   * Get default league for a user
   */
  getDefaultLeague(discordId: string, guildId?: string): Promise<string | null>;
}

/**
 * UserPreference service implementation
 */
export class UserPreferenceService implements IUserPreferenceService {
  constructor(
    private userPreferenceRepository: IUserPreferenceRepository,
    private leagueRepository: ILeagueRepository
  ) {}
  
  /**
   * Create a new user preference service instance
   */
  static async create(): Promise<UserPreferenceService> {
    const userPreferenceRepo = await UserPreferenceRepository.create();
    const leagueRepo = await LeagueRepository.create();
    
    return new UserPreferenceService(userPreferenceRepo, leagueRepo);
  }
  
  /**
   * Get user preference by Discord ID and guild ID
   */
  async getUserPreference(discordId: string, guildId?: string): Promise<UserPreference | null> {
    return this.userPreferenceRepository.findByDiscordIdAndGuildId(discordId, guildId);
  }
  
  /**
   * Set default league for a user
   */
  async setDefaultLeague(discordId: string, leagueName: string, guildId?: string): Promise<UserPreference> {
    try {
      // Find the league
      const league = await this.leagueRepository.findByNameAndGuildId(leagueName, guildId || '');
      
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }
      
      // Set default league
      return this.userPreferenceRepository.setDefaultLeague(discordId, league.id, guildId);
    } catch (error) {
      console.error('Error setting default league:', error);
      throw error;
    }
  }
  
  /**
   * Get default league for a user
   */
  async getDefaultLeague(discordId: string, guildId?: string): Promise<string | null> {
    try {
      // Get user preference
      const preference = await this.userPreferenceRepository.findByDiscordIdAndGuildId(discordId, guildId);
      
      if (!preference || !preference.defaultLeagueId) {
        return null;
      }
      
      // Find the league
      const league = await this.leagueRepository.findById(preference.defaultLeagueId);
      
      if (!league) {
        return null;
      }
      
      return league.name;
    } catch (error) {
      console.error('Error getting default league:', error);
      return null;
    }
  }
}
