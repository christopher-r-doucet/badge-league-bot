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
import { League } from '../entities/League.js';
import { Player } from '../entities/Player.js';
import { Match } from '../entities/Match.js';
import { UserPreference } from '../entities/UserPreference.js';

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
  private static initialized = false;
  
  /**
   * Initialize the database connection
   */
  static async init(): Promise<void> {
    if (this.initialized) {
      console.log('Database already initialized');
      return;
    }
    
    try {
      console.log('Initializing database connection...');
      this.dataSource = await DatabaseConnection.getConnection();
      
      // Log available entity metadata for debugging
      console.log(`Available entity metadata: ${this.dataSource.entityMetadatas.map(meta => meta.name).join(', ')}`);
      
      console.log('Database connection initialized');
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
  
  /**
   * Get the match service instance
   */
  static async getMatchService(): Promise<MatchService> {
    await this.ensureInitialized();
    if (!this.matchServiceInstance) {
      this.matchServiceInstance = await MatchService.create();
    }
    return this.matchServiceInstance;
  }
  
  /**
   * Get the player service instance
   */
  static async getPlayerService(): Promise<PlayerService> {
    await this.ensureInitialized();
    if (!this.playerServiceInstance) {
      this.playerServiceInstance = await PlayerService.create();
    }
    return this.playerServiceInstance;
  }
  
  /**
   * Get the league service instance
   */
  static async getLeagueService(): Promise<LeagueService> {
    await this.ensureInitialized();
    if (!this.leagueServiceInstance) {
      this.leagueServiceInstance = await LeagueService.create();
    }
    return this.leagueServiceInstance;
  }
  
  /**
   * Get the user preference service instance
   */
  static async getUserPreferenceService(): Promise<UserPreferenceService> {
    await this.ensureInitialized();
    if (!this.userPreferenceServiceInstance) {
      this.userPreferenceServiceInstance = await UserPreferenceService.create();
    }
    return this.userPreferenceServiceInstance;
  }
  
  /**
   * Ensure the database is initialized
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
  
  // MATCH SERVICE METHODS
  
  /**
   * Get player matches
   */
  static async getPlayerMatches(discordId: string, status?: any, guildId?: string): Promise<any[]> {
    await this.ensureInitialized();
    const matchService = await this.getMatchService();
    return matchService.getPlayerMatches(discordId, status, guildId);
  }
  
  /**
   * Get match by ID
   */
  static async getMatch(matchId: string): Promise<any | null> {
    await this.ensureInitialized();
    const matchService = await this.getMatchService();
    return matchService.getMatch(matchId);
  }
  
  /**
   * Get scheduled matches
   */
  static async getScheduledMatches(leagueName: string): Promise<any[]> {
    await this.ensureInitialized();
    const matchService = await this.getMatchService();
    return matchService.getScheduledMatches(leagueName);
  }
  
  /**
   * Schedule a match between two players
   * @param leagueName Name of the league
   * @param player1Id Discord ID of player 1
   * @param player2Id Discord ID of player 2
   * @param guildId Discord guild ID
   * @param scheduledDate Optional scheduled date for the match
   * @param useRandomDecks Whether to assign random deck colors
   * @returns The created match
   */
  static async scheduleMatch(
    leagueName: string, 
    player1Id: string, 
    player2Id: string, 
    guildId: string, 
    scheduledDate?: Date,
    useRandomDecks: boolean = false
  ): Promise<Match> {
    await Database.ensureInitialized();
    const matchService = await Database.getMatchService();
    return matchService.scheduleMatch(leagueName, player1Id, player2Id, guildId, scheduledDate, useRandomDecks);
  }
  
  /**
   * Confirm a match
   */
  static async confirmMatch(matchId: string, discordId: string): Promise<any> {
    await this.ensureInitialized();
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
    await this.ensureInitialized();
    const matchService = await this.getMatchService();
    return matchService.reportMatchResult(matchId, reporterId, player1Score, player2Score);
  }
  
  /**
   * Cancel a match
   */
  static async cancelMatch(matchId: string, discordId: string): Promise<any> {
    await this.ensureInitialized();
    const matchService = await this.getMatchService();
    return matchService.cancelMatch(matchId, discordId);
  }
  
  /**
   * Get all active matches for a player in a specific league
   */
  static async getPlayerActiveMatches(discordId: string, leagueId: string): Promise<any[]> {
    await this.ensureInitialized();
    const matchService = await this.getMatchService();
    return matchService.getPlayerActiveMatches(discordId, leagueId);
  }
  
  // PLAYER SERVICE METHODS
  
  /**
   * Get a player by Discord ID and league name
   */
  static async getPlayer(discordId: string, leagueName: string, guildId?: string): Promise<any | null> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.getPlayer(discordId, leagueName, guildId);
  }
  
  /**
   * Get player stats
   */
  static async getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<any | null> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.getPlayerStats(discordId, leagueName, guildId);
  }
  
  /**
   * Get players in a league
   */
  static async getLeaguePlayers(leagueName: string): Promise<any[]> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.getLeaguePlayers(leagueName);
  }
  
  /**
   * Add a player to a league
   */
  static async addPlayerToLeague(discordId: string, username: string, leagueName: string, guildId: string): Promise<any> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.addPlayerToLeague(discordId, username, leagueName, guildId);
  }
  
  /**
   * Update player username
   */
  static async updatePlayerUsername(discordId: string, username: string): Promise<void> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.updatePlayerUsername(discordId, username);
  }
  
  /**
   * Update player rank
   */
  static async updatePlayerRank(playerId: string): Promise<any> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.updatePlayerRank(playerId);
  }
  
  /**
   * Check if a player is in a league
   */
  static async isPlayerInLeague(discordId: string, leagueName: string, guildId?: string): Promise<boolean> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.isPlayerInLeague(discordId, leagueName, guildId);
  }
  
  /**
   * Get all leagues a player is in
   */
  static async getPlayerLeagues(discordId: string, guildId?: string): Promise<any[]> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.getPlayerLeagues(discordId, guildId);
  }
  
  /**
   * Remove a player from a league
   */
  static async removePlayerFromLeague(discordId: string, leagueId: string): Promise<boolean> {
    await this.ensureInitialized();
    const playerService = await this.getPlayerService();
    return playerService.removePlayerFromLeague(discordId, leagueId);
  }
  
  // LEAGUE SERVICE METHODS
  
  /**
   * Get all leagues in a guild
   */
  static async getGuildLeagues(guildId?: string): Promise<any[]> {
    try {
      await this.ensureInitialized();
      const leagueService = await this.getLeagueService();
      return leagueService.getGuildLeagues(guildId);
    } catch (error) {
      console.error('Error getting guild leagues:', error);
      
      // Try to access the repository directly as a fallback
      try {
        console.log('Attempting direct repository access for League entity');
        
        // Ensure we have a connection
        if (!this.dataSource || !this.dataSource.isInitialized) {
          console.log('Database connection not initialized, attempting to initialize...');
          this.dataSource = await DatabaseConnection.getConnection();
        }
        
        const leagueRepository = this.dataSource.getRepository(League);
        const query = leagueRepository.createQueryBuilder('league');
        
        if (guildId) {
          query.where('league.guildId = :guildId', { guildId });
        }
        
        const leagues = await query.getMany();
        console.log(`Found ${leagues.length} leagues using direct repository access`);
        return leagues;
      } catch (fallbackError) {
        console.error('Fallback error getting leagues:', fallbackError);
        // Return empty array instead of throwing to prevent command failures
        console.log('Returning empty array as fallback');
        return [];
      }
    }
  }
  
  /**
   * Get a league by name and guild ID
   */
  static async getLeague(name: string, guildId: string): Promise<any | null> {
    await this.ensureInitialized();
    const leagueService = await this.getLeagueService();
    return leagueService.getLeague(name, guildId);
  }
  
  /**
   * Create a new league
   */
  static async createLeague(leagueData: { name: string, guildId: string, creatorId: string }): Promise<any> {
    await this.ensureInitialized();
    const leagueService = await this.getLeagueService();
    return leagueService.createLeague(leagueData);
  }
  
  /**
   * Get league leaderboard
   */
  static async getLeagueLeaderboard(leagueName: string): Promise<any[]> {
    await this.ensureInitialized();
    const leagueService = await this.getLeagueService();
    return leagueService.getLeagueLeaderboard(leagueName);
  }
  
  /**
   * Delete a league (only if creator or admin, and no active matches)
   */
  static async deleteLeague(leagueId: string, discordId: string, guildId?: string): Promise<boolean> {
    await this.ensureInitialized();
    const leagueService = await this.getLeagueService();
    return leagueService.deleteLeague(leagueId, discordId, guildId);
  }
  
  /**
   * Check if a user is the creator of a league
   */
  static async isLeagueCreator(leagueId: string, discordId: string): Promise<boolean> {
    await this.ensureInitialized();
    const leagueService = await this.getLeagueService();
    return leagueService.isLeagueCreator(leagueId, discordId);
  }
  
  /**
   * Get leagues created by a user
   */
  static async getCreatedLeagues(discordId: string, guildId?: string): Promise<any[]> {
    await this.ensureInitialized();
    const leagueService = await this.getLeagueService();
    return leagueService.getCreatedLeagues(discordId, guildId);
  }
  
  // USER PREFERENCE METHODS
  
  /**
   * Get user preference
   */
  static async getUserPreference(discordId: string, guildId?: string): Promise<any | null> {
    await this.ensureInitialized();
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.getUserPreference(discordId, guildId);
  }
  
  /**
   * Set default league for a user
   */
  static async setDefaultLeague(discordId: string, leagueName: string, guildId?: string): Promise<any> {
    await this.ensureInitialized();
    const userPreferenceService = await this.getUserPreferenceService();
    return userPreferenceService.setDefaultLeague(discordId, leagueName, guildId);
  }
  
  /**
   * Get default league for a user
   */
  static async getDefaultLeague(discordId: string, guildId?: string): Promise<string | null> {
    await this.ensureInitialized();
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
