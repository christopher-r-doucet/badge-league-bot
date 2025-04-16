import { League } from '../../entities/League.js';
import { ILeagueRepository, LeagueRepository } from '../repositories/league-repository.js';
import { IPlayerRepository, PlayerRepository } from '../repositories/player-repository.js';
import { IMatchRepository, MatchRepository } from '../repositories/match-repository.js';
import { MatchStatus } from '../../entities/Match.js';

/**
 * League service interface
 */
export interface ILeagueService {
  /**
   * Get all leagues in a guild
   */
  getGuildLeagues(guildId?: string): Promise<League[]>;
  
  /**
   * Get a league by name and guild ID
   */
  getLeague(name: string, guildId: string): Promise<League | null>;
  
  /**
   * Create a new league
   */
  createLeague(leagueData: { name: string, guildId: string, creatorId: string }): Promise<League>;
  
  /**
   * Get league leaderboard
   */
  getLeagueLeaderboard(leagueName: string): Promise<any[]>;
  
  /**
   * Check if a user is the creator of a league
   */
  isLeagueCreator(leagueId: string, discordId: string): Promise<boolean>;
  
  /**
   * Delete a league (only if creator or admin, and no active matches)
   */
  deleteLeague(leagueId: string, discordId: string, guildId?: string): Promise<boolean>;
  
  /**
   * Get leagues created by a user
   */
  getCreatedLeagues(discordId: string, guildId?: string): Promise<any[]>;
}

/**
 * League service implementation
 */
export class LeagueService implements ILeagueService {
  constructor(
    private leagueRepository: ILeagueRepository,
    private playerRepository: IPlayerRepository,
    private matchRepository: IMatchRepository
  ) {}
  
  /**
   * Create a new league service instance
   */
  static async create(): Promise<LeagueService> {
    const leagueRepo = await LeagueRepository.create();
    const playerRepo = await PlayerRepository.create();
    const matchRepo = await MatchRepository.create();
    
    return new LeagueService(leagueRepo, playerRepo, matchRepo);
  }
  
  /**
   * Get all leagues in a guild
   */
  async getGuildLeagues(guildId?: string): Promise<League[]> {
    return this.leagueRepository.findByGuildId(guildId);
  }
  
  /**
   * Get a league by name and guild ID
   */
  async getLeague(name: string, guildId: string): Promise<League | null> {
    return this.leagueRepository.findByNameAndGuildId(name, guildId);
  }
  
  /**
   * Create a new league
   */
  async createLeague(leagueData: { name: string, guildId: string, creatorId: string }): Promise<League> {
    const league = new League();
    league.name = leagueData.name;
    league.guildId = leagueData.guildId;
    league.creatorId = leagueData.creatorId;
    
    return this.leagueRepository.save(league);
  }
  
  /**
   * Get league leaderboard
   */
  async getLeagueLeaderboard(leagueName: string): Promise<any[]> {
    try {
      // Get all players in the league
      const players = await this.playerRepository.findByLeagueName(leagueName);
      
      if (!players || players.length === 0) {
        return [];
      }
      
      // Sort by ELO (already done in repository)
      // Add rank information
      const leaderboard = players.map((player, index) => {
        return {
          ...player,
          position: index + 1,
          rankDisplay: this.getRankDisplay(player.rank)
        };
      });
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting league leaderboard:', error);
      throw error;
    }
  }
  
  /**
   * Check if a user is the creator of a league
   */
  async isLeagueCreator(leagueId: string, discordId: string): Promise<boolean> {
    try {
      const league = await this.leagueRepository.findById(leagueId);
      
      if (!league) {
        return false;
      }
      
      // Check if the league has a creatorId field
      if (!league.creatorId) {
        console.log(`League ${leagueId} has no creator ID`);
        return false;
      }
      
      return league.creatorId === discordId;
    } catch (error) {
      console.error('Error checking if user is league creator:', error);
      throw error;
    }
  }
  
  /**
   * Delete a league (only if creator or admin, and no active matches)
   */
  async deleteLeague(leagueId: string, discordId: string, guildId?: string): Promise<boolean> {
    try {
      // Check if the user is the creator of the league
      const isCreator = await this.isLeagueCreator(leagueId, discordId);
      
      // Check if the user is an admin (currently only one admin user)
      const isAdmin = discordId === '125313671906852864'; // Admin user ID
      
      if (!isCreator && !isAdmin) {
        throw new Error('Only the league creator or an admin can delete a league');
      }
      
      // Get the league
      const league = await this.leagueRepository.findById(leagueId);
      
      if (!league) {
        throw new Error('League not found');
      }
      
      // If not admin, check for active matches and players
      if (!isAdmin) {
        // Check if there are any active matches in the league
        const activeMatches = await this.matchRepository.findByStatusAndLeague(MatchStatus.SCHEDULED, leagueId);
        
        if (activeMatches.length > 0) {
          throw new Error('Cannot delete league with active matches');
        }
        
        // Check if there are any players in the league
        const players = await this.playerRepository.findByLeagueId(leagueId);
        
        if (players.length > 0) {
          throw new Error('Cannot delete league with players. All players must leave first.');
        }
      } else {
        console.log(`Admin user ${discordId} is deleting league ${leagueId} with override privileges`);
      }
      
      // Delete the league
      await this.leagueRepository.delete(leagueId);
      
      return true;
    } catch (error) {
      console.error('Error deleting league:', error);
      throw error;
    }
  }
  
  /**
   * Get leagues created by a user
   */
  async getCreatedLeagues(discordId: string, guildId?: string): Promise<any[]> {
    try {
      // Find all leagues created by this user
      const leagues = await this.leagueRepository.findBy({
        creatorId: discordId,
        ...(guildId ? { guildId } : {})
      });
      
      return leagues;
    } catch (error) {
      console.error('Error getting leagues created by user:', error);
      throw error;
    }
  }
  
  /**
   * Get rank display with emoji
   * @private
   */
  private getRankDisplay(rank: string): string {
    switch (rank) {
      case 'Bronze':
        return '🥉 Bronze';
      case 'Silver':
        return '⚪ Silver';
      case 'Gold':
        return '🥇 Gold';
      case 'Diamond':
        return '💎 Diamond';
      case 'Master':
        return '👑 Master';
      case 'Grandmaster':
        return '🏆 Grandmaster';
      default:
        return rank;
    }
  }
}
