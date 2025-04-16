import { DataSource } from 'typeorm';
import { DatabaseConnection } from './connection.js';
import { MatchRepository } from './repositories/match-repository.js';
import { PlayerRepository } from './repositories/player-repository.js';
import { LeagueRepository } from './repositories/league-repository.js';
import { UserPreferenceRepository } from './repositories/user-preference-repository.js';
import { MatchService } from './services/match-service.js';
import { PlayerService } from './services/player-service.js';
import { LeagueService } from './services/league-service.js';
import { UserPreferenceService } from './services/user-preference-service.js';

/**
 * Database class that provides access to all repositories and services
 * This is a facade over the individual repositories and services
 */
export class Database {
  private static matchServiceInstance: MatchService;
  private static playerServiceInstance: PlayerService;
  private static leagueServiceInstance: LeagueService;
  private static userPreferenceServiceInstance: UserPreferenceService;
  private static dataSource: DataSource;
  
  /**
   * Initialize the database connection
   */
  static async init(): Promise<void> {
    this.dataSource = await DatabaseConnection.getConnection();
    console.log('Database connection initialized');
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
  
  // MATCH SERVICE METHODS
  
  /**
   * Get player matches
   */
  static async getPlayerMatches(discordId: string, status?: any, guildId?: string): Promise<any[]> {
    const matchService = await this.getMatchService();
    return matchService.getPlayerMatches(discordId, status, guildId);
  }
  
  /**
   * Get match by ID
   */
  static async getMatch(matchId: string): Promise<any | null> {
    const matchService = await this.getMatchService();
    return matchService.getMatch(matchId);
  }
  
  /**
   * Get scheduled matches
   */
  static async getScheduledMatches(leagueName: string): Promise<any[]> {
    const matchService = await this.getMatchService();
    return matchService.getScheduledMatches(leagueName);
  }
  
  /**
   * Schedule a match
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
   * Confirm a match
   */
  static async confirmMatch(matchId: string, discordId: string): Promise<any> {
    const matchService = await this.getMatchService();
    return matchService.confirmMatch(matchId, discordId);
  }
  
  /**
   * Report match result
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
   * Cancel a match
   */
  static async cancelMatch(matchId: string, discordId: string): Promise<any> {
    const matchService = await this.getMatchService();
    return matchService.cancelMatch(matchId, discordId);
  }
  
  // PLAYER SERVICE METHODS
  
  /**
   * Get a player by Discord ID and league name
   */
  static async getPlayer(discordId: string, leagueName: string, guildId?: string): Promise<any | null> {
    const playerService = await this.getPlayerService();
    return playerService.getPlayer(discordId, leagueName, guildId);
  }
  
  /**
   * Get player stats
   */
  static async getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<any | null> {
    const playerService = await this.getPlayerService();
    return playerService.getPlayerStats(discordId, leagueName, guildId);
  }
  
  /**
   * Get players in a league
   */
  static async getLeaguePlayers(leagueName: string): Promise<any[]> {
    const playerService = await this.getPlayerService();
    return playerService.getLeaguePlayers(leagueName);
  }
  
  /**
   * Add a player to a league
   */
  static async addPlayerToLeague(discordId: string, username: string, leagueName: string, guildId: string): Promise<any> {
    const playerService = await this.getPlayerService();
    return playerService.addPlayerToLeague(discordId, username, leagueName, guildId);
  }
  
  /**
   * Update player username
   */
  static async updatePlayerUsername(discordId: string, username: string): Promise<void> {
    const playerService = await this.getPlayerService();
    return playerService.updatePlayerUsername(discordId, username);
  }
  
  /**
   * Update player rank
   */
  static async updatePlayerRank(playerId: string): Promise<any> {
    const playerService = await this.getPlayerService();
    return playerService.updatePlayerRank(playerId);
  }
  
  /**
   * Check if a player is in a league
   */
  static async isPlayerInLeague(discordId: string, leagueName: string, guildId?: string): Promise<boolean> {
    const playerService = await this.getPlayerService();
    return playerService.isPlayerInLeague(discordId, leagueName, guildId);
  }
  
  /**
   * Get all leagues a player is in
   */
  static async getPlayerLeagues(discordId: string, guildId?: string): Promise<any[]> {
    const playerService = await this.getPlayerService();
    return playerService.getPlayerLeagues(discordId, guildId);
  }
  
  // LEAGUE SERVICE METHODS
  
  /**
   * Get all leagues in a guild
   */
  static async getGuildLeagues(guildId?: string): Promise<any[]> {
    const leagueService = await this.getLeagueService();
    return leagueService.getGuildLeagues(guildId);
  }
  
  /**
   * Get a league by name and guild ID
   */
  static async getLeague(name: string, guildId: string): Promise<any | null> {
    const leagueService = await this.getLeagueService();
    return leagueService.getLeague(name, guildId);
  }
  
  /**
   * Create a new league
   */
  static async createLeague(name: string, guildId: string): Promise<any> {
    const leagueService = await this.getLeagueService();
    return leagueService.createLeague(name, guildId);
  }
  
  /**
   * Get league leaderboard
   */
  static async getLeagueLeaderboard(leagueName: string): Promise<any[]> {
    const leagueService = await this.getLeagueService();
    return leagueService.getLeagueLeaderboard(leagueName);
  }
  
  // USER PREFERENCE METHODS
  
  /**
   * Get user preference
   */
  static async getUserPreference(discordId: string, guildId?: string): Promise<any | null> {
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.getUserPreference(discordId, guildId);
  }
  
  /**
   * Set default league for a user
   */
  static async setDefaultLeague(discordId: string, leagueName: string, guildId?: string): Promise<any> {
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.setDefaultLeague(discordId, leagueName, guildId);
  }
  
  /**
   * Get default league for a user
   */
  static async getDefaultLeague(discordId: string, guildId?: string): Promise<string | null> {
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.getDefaultLeague(discordId, guildId);
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
export const db = Database;
