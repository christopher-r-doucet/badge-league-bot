import { League } from '../../entities/League.js';
import { ILeagueRepository, LeagueRepository } from '../repositories/league-repository.js';
import { IPlayerRepository, PlayerRepository } from '../repositories/player-repository.js';

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
  createLeague(name: string, guildId: string): Promise<League>;
  
  /**
   * Get league leaderboard
   */
  getLeagueLeaderboard(leagueName: string): Promise<any[]>;
}

/**
 * League service implementation
 */
export class LeagueService implements ILeagueService {
  constructor(
    private leagueRepository: ILeagueRepository,
    private playerRepository: IPlayerRepository
  ) {}
  
  /**
   * Create a new league service instance
   */
  static async create(): Promise<LeagueService> {
    const leagueRepo = await LeagueRepository.create();
    const playerRepo = await PlayerRepository.create();
    
    return new LeagueService(leagueRepo, playerRepo);
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
  async createLeague(name: string, guildId: string): Promise<League> {
    return this.leagueRepository.createLeague(name, guildId);
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
