import { DatabaseConnection } from './connection.js';
import { MatchRepository } from './repositories/match-repository.js';
import { PlayerRepository } from './repositories/player-repository.js';
import { LeagueRepository } from './repositories/league-repository.js';
import { UserPreferenceRepository } from './repositories/user-preference-repository.js';
import { MatchService } from './services/match-service.js';
import { PlayerService } from './services/player-service.js';
import { LeagueService } from './services/league-service.js';
import { UserPreferenceService } from './services/user-preference-service.js';

// Legacy database instance
import { db } from './index.js';

/**
 * Database class that provides access to all repositories and services
 * This is a facade over the individual repositories and services
 */
export class Database {
  private static matchServiceInstance: MatchService;
  private static playerServiceInstance: PlayerService;
  private static leagueServiceInstance: LeagueService;
  private static userPreferenceServiceInstance: UserPreferenceService;
  
  /**
   * Initialize the database connection
   */
  static async init(): Promise<void> {
    await DatabaseConnection.getConnection();
    
    // Initialize legacy database
    await db.init();
  }
  
  /**
   * Get the match service instance
   */
  static async getMatchService(): Promise<MatchService> {
    if (!this.matchServiceInstance) {
      this.matchServiceInstance = await MatchService.create();
    }
    return this.matchServiceInstance;
  }
  
  /**
   * Get the player service instance
   */
  static async getPlayerService(): Promise<PlayerService> {
    if (!this.playerServiceInstance) {
      this.playerServiceInstance = await PlayerService.create();
    }
    return this.playerServiceInstance;
  }
  
  /**
   * Get the league service instance
   */
  static async getLeagueService(): Promise<LeagueService> {
    if (!this.leagueServiceInstance) {
      this.leagueServiceInstance = await LeagueService.create();
    }
    return this.leagueServiceInstance;
  }
  
  /**
   * Get the user preference service instance
   */
  static async getUserPreferenceService(): Promise<UserPreferenceService> {
    if (!this.userPreferenceServiceInstance) {
      this.userPreferenceServiceInstance = await UserPreferenceService.create();
    }
    return this.userPreferenceServiceInstance;
  }
  
  // MATCH SERVICE PROXY METHODS
  
  /**
   * Get player matches using the new service
   * This is a proxy method for backward compatibility
   */
  static async getPlayerMatches(discordId: string, status?: any, guildId?: string): Promise<any[]> {
    const matchService = await this.getMatchService();
    return matchService.getPlayerMatches(discordId, status, guildId);
  }
  
  /**
   * Get match by ID using the new service
   * This is a proxy method for backward compatibility
   */
  static async getMatch(matchId: string): Promise<any | null> {
    const matchService = await this.getMatchService();
    return matchService.getMatch(matchId);
  }
  
  /**
   * Get scheduled matches using the new service
   * This is a proxy method for backward compatibility
   */
  static async getScheduledMatches(leagueName: string): Promise<any[]> {
    const matchService = await this.getMatchService();
    return matchService.getScheduledMatches(leagueName);
  }
  
  /**
   * Schedule a match using the new service
   * This is a proxy method for backward compatibility
   */
  static async scheduleMatch(
    leagueName: string, 
    player1Id: string, 
    player2Id: string, 
    guildId: string, 
    scheduledDate?: Date
  ): Promise<any> {
    const matchService = await this.getMatchService();
    return matchService.scheduleMatch(leagueName, player1Id, player2Id, guildId, scheduledDate);
  }
  
  /**
   * Confirm a match using the new service
   * This is a proxy method for backward compatibility
   */
  static async confirmMatch(matchId: string, discordId: string): Promise<any> {
    const matchService = await this.getMatchService();
    return matchService.confirmMatch(matchId, discordId);
  }
  
  /**
   * Report match result using the new service
   * This is a proxy method for backward compatibility
   */
  static async reportMatchResult(
    matchId: string, 
    reporterId: string, 
    player1Score: number, 
    player2Score: number
  ): Promise<any> {
    const matchService = await this.getMatchService();
    return matchService.reportMatchResult(matchId, reporterId, player1Score, player2Score);
  }
  
  /**
   * Cancel a match using the new service
   * This is a proxy method for backward compatibility
   */
  static async cancelMatch(matchId: string, discordId: string): Promise<any> {
    const matchService = await this.getMatchService();
    return matchService.cancelMatch(matchId, discordId);
  }
  
  // PLAYER SERVICE PROXY METHODS
  
  /**
   * Get a player by Discord ID and league name
   * This is a proxy method for backward compatibility
   */
  static async getPlayer(discordId: string, leagueName: string, guildId?: string): Promise<any | null> {
    const playerService = await this.getPlayerService();
    return playerService.getPlayer(discordId, leagueName, guildId);
  }
  
  /**
   * Get player stats
   * This is a proxy method for backward compatibility
   */
  static async getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<any | null> {
    const playerService = await this.getPlayerService();
    return playerService.getPlayerStats(discordId, leagueName, guildId);
  }
  
  /**
   * Get players in a league
   * This is a proxy method for backward compatibility
   */
  static async getLeaguePlayers(leagueName: string): Promise<any[]> {
    const playerService = await this.getPlayerService();
    return playerService.getLeaguePlayers(leagueName);
  }
  
  /**
   * Add a player to a league
   * This is a proxy method for backward compatibility
   */
  static async addPlayerToLeague(discordId: string, username: string, leagueName: string, guildId: string): Promise<any> {
    const playerService = await this.getPlayerService();
    return playerService.addPlayerToLeague(discordId, username, leagueName, guildId);
  }
  
  /**
   * Update player username
   * This is a proxy method for backward compatibility
   */
  static async updatePlayerUsername(discordId: string, username: string): Promise<void> {
    const playerService = await this.getPlayerService();
    return playerService.updatePlayerUsername(discordId, username);
  }
  
  // LEAGUE SERVICE PROXY METHODS
  
  /**
   * Get all leagues in a guild
   * This is a proxy method for backward compatibility
   */
  static async getGuildLeagues(guildId?: string): Promise<any[]> {
    const leagueService = await this.getLeagueService();
    return leagueService.getGuildLeagues(guildId);
  }
  
  /**
   * Get a league by name and guild ID
   * This is a proxy method for backward compatibility
   */
  static async getLeague(name: string, guildId: string): Promise<any | null> {
    const leagueService = await this.getLeagueService();
    return leagueService.getLeague(name, guildId);
  }
  
  /**
   * Create a new league
   * This is a proxy method for backward compatibility
   */
  static async createLeague(name: string, guildId: string): Promise<any> {
    const leagueService = await this.getLeagueService();
    return leagueService.createLeague(name, guildId);
  }
  
  /**
   * Get league leaderboard
   * This is a proxy method for backward compatibility
   */
  static async getLeagueLeaderboard(leagueName: string): Promise<any[]> {
    const leagueService = await this.getLeagueService();
    return leagueService.getLeagueLeaderboard(leagueName);
  }
  
  // USER PREFERENCE PROXY METHODS
  
  /**
   * Get user preference
   * This is a proxy method for backward compatibility
   */
  static async getUserPreference(discordId: string, guildId?: string): Promise<any | null> {
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.getUserPreference(discordId, guildId);
  }
  
  /**
   * Set default league for a user
   * This is a proxy method for backward compatibility
   */
  static async setDefaultLeague(discordId: string, leagueName: string, guildId?: string): Promise<any> {
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.setDefaultLeague(discordId, leagueName, guildId);
  }
  
  /**
   * Get default league for a user
   * This is a proxy method for backward compatibility
   */
  static async getDefaultLeague(discordId: string, guildId?: string): Promise<string | null> {
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.getDefaultLeague(discordId, guildId);
  }
  
  /**
   * Use the legacy database for all other methods
   * This allows for gradual migration
   */
  static get legacy(): typeof db {
    return db;
  }
}

// Export repositories and services for direct access
export {
  MatchRepository,
  PlayerRepository,
  LeagueRepository,
  UserPreferenceRepository,
  MatchService,
  PlayerService,
  LeagueService,
  UserPreferenceService
};

// Export a default instance for backward compatibility
export const newDb = Database;
