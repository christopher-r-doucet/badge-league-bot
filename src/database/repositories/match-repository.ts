import { Repository, DataSource, In } from 'typeorm';
import { Match, MatchStatus } from '../../entities/Match.js';
import { Player } from '../../entities/Player.js';
import { League } from '../../entities/League.js';
import { BaseRepository, IBaseRepository } from './base-repository.js';
import { DatabaseConnection } from '../connection.js';
import { PlayerRepository } from './player-repository.js';

/**
 * Match repository interface
 */
export interface IMatchRepository extends IBaseRepository<Match> {
  /**
   * Find matches by player Discord ID
   */
  findByPlayerDiscordId(discordId: string, status?: MatchStatus, guildId?: string): Promise<any[]>;
  
  /**
   * Find matches by league name
   */
  findByLeagueName(leagueName: string, status?: MatchStatus): Promise<any[]>;
  
  /**
   * Find a match by ID with player and league details
   */
  findByIdWithDetails(matchId: string): Promise<any | null>;
  
  /**
   * Find matches by league ID
   */
  findByLeague(leagueId: string): Promise<Match[]>;
  
  /**
   * Find matches by player ID
   */
  findByPlayer(playerId: string): Promise<Match[]>;
  
  /**
   * Find matches by player ID and league ID
   */
  findByPlayerAndLeague(playerId: string, leagueId: string): Promise<Match[]>;
  
  /**
   * Find matches by player Discord ID and status
   */
  findByPlayerDiscordIdAndStatus(discordId: string, status: MatchStatus): Promise<Match[]>;
  
  /**
   * Find matches by player Discord ID and league ID
   */
  findByPlayerDiscordIdAndLeagueId(discordId: string, leagueId: string): Promise<Match[]>;
  
  /**
   * Find matches by player Discord ID, league ID, and status
   */
  findByPlayerDiscordIdAndLeagueIdAndStatus(discordId: string, leagueId: string, status: MatchStatus): Promise<Match[]>;
  
  /**
   * Find matches by status
   */
  findByStatus(status: MatchStatus): Promise<Match[]>;
  
  /**
   * Find matches by status and league ID
   */
  findByStatusAndLeague(status: MatchStatus, leagueId: string): Promise<Match[]>;
  
  /**
   * Find matches by criteria
   */
  find(options: any): Promise<Match[]>;
}

/**
 * Match repository implementation
 */
export class MatchRepository extends BaseRepository<Match> implements IMatchRepository {
  private playerRepository: Repository<Player>;
  private leagueRepository: Repository<League>;
  
  private constructor(dataSource: DataSource) {
    super(dataSource.getRepository(Match));
    this.playerRepository = dataSource.getRepository(Player);
    this.leagueRepository = dataSource.getRepository(League);
  }
  
  /**
   * Create a new match repository instance
   */
  static async create(): Promise<MatchRepository> {
    const dataSource = await DatabaseConnection.getConnection();
    return new MatchRepository(dataSource);
  }
  
  /**
   * Find matches by player Discord ID
   */
  async findByPlayerDiscordId(discordId: string, status?: MatchStatus, guildId?: string): Promise<any[]> {
    // First, find all players with this Discord ID
    const playerRepo = await PlayerRepository.create();
    const players = await playerRepo.findByDiscordId(discordId);
    
    if (!players || players.length === 0) {
      return [];
    }
    
    const playerIds = players.map((player: Player) => player.id);
    
    // Build the query based on whether status is provided
    let whereClause: any[] = [
      { player1Id: In(playerIds) },
      { player2Id: In(playerIds) }
    ];
    
    if (status) {
      whereClause = [
        { player1Id: In(playerIds), status },
        { player2Id: In(playerIds), status }
      ];
    }
    
    // Find all matches where the player is a participant
    const matches = await this.repository.find({
      where: whereClause
    });
    
    // Enrich the matches with player and league details
    const enrichedMatches = await Promise.all(matches.map(async (match) => {
      // Get player details
      const player1 = await this.playerRepository.findOne({ where: { id: match.player1Id } });
      const player2 = await this.playerRepository.findOne({ where: { id: match.player2Id } });
      
      // Create enriched player objects with fallbacks for missing data
      const enrichedPlayer1 = player1 ? {
        ...player1,
        discordId: player1.discordId || 'unknown',
        username: player1.username || 'Unknown Player'
      } : { 
        id: match.player1Id,
        discordId: 'unknown',
        username: 'Unknown Player',
        elo: 0
      };
      
      const enrichedPlayer2 = player2 ? {
        ...player2,
        discordId: player2.discordId || 'unknown',
        username: player2.username || 'Unknown Player'
      } : {
        id: match.player2Id,
        discordId: 'unknown',
        username: 'Unknown Player',
        elo: 0
      };
      
      // Get league details if not already loaded
      let league = null;
      if (match.leagueId) {
        league = await this.leagueRepository.findOne({ where: { id: match.leagueId } });
      }
      
      // Return the enriched match
      return {
        ...match,
        league,
        player1: enrichedPlayer1,
        player2: enrichedPlayer2,
        // For convenience, determine who the opponent is
        opponent: match.player1Id === enrichedPlayer1.id ? enrichedPlayer2 : enrichedPlayer1,
        opponentUsername: match.player1Id === enrichedPlayer1.id ? enrichedPlayer2.username : enrichedPlayer1.username,
        // Keep the IDs directly accessible for backward compatibility
        player1Id: match.player1Id,
        player2Id: match.player2Id
      };
    }));
    
    return enrichedMatches;
  }
  
  /**
   * Find matches by league name
   */
  async findByLeagueName(leagueName: string, status?: MatchStatus): Promise<any[]> {
    try {
      const league = await this.leagueRepository.findOne({ 
        where: { name: leagueName }
      });

      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      // Find matches
      const matchQuery: any = { 
        leagueId: league.id
      };
      
      if (status) {
        matchQuery.status = status;
      }
      
      const matches = await this.repository.find({
        where: matchQuery,
        order: { scheduledDate: 'ASC' }
      });

      // Enrich matches with player and league data
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const player1 = await this.playerRepository.findOne({ where: { id: match.player1Id } });
        const player2 = await this.playerRepository.findOne({ where: { id: match.player2Id } });
        
        return {
          ...match,
          league,
          player1,
          player2
        };
      }));

      return enrichedMatches;
    } catch (error) {
      console.error('Error getting matches by league:', error);
      throw error;
    }
  }
  
  /**
   * Find a match by ID with player and league details
   */
  async findByIdWithDetails(matchId: string): Promise<any | null> {
    try {
      const match = await this.findById(matchId);
      
      if (!match) return null;
      
      // Get related entities
      const player1 = await this.playerRepository.findOne({ where: { id: match.player1Id } });
      const player2 = await this.playerRepository.findOne({ where: { id: match.player2Id } });
      const league = await this.leagueRepository.findOne({ where: { id: match.leagueId } });
      
      // Ensure we have valid player objects with discordId and username
      const enrichedPlayer1 = player1 ? {
        ...player1,
        discordId: player1.discordId || 'unknown',
        username: player1.username || 'Unknown Player'
      } : { 
        id: match.player1Id,
        discordId: 'unknown',
        username: 'Unknown Player',
        elo: 0
      };
      
      const enrichedPlayer2 = player2 ? {
        ...player2,
        discordId: player2.discordId || 'unknown',
        username: player2.username || 'Unknown Player'
      } : {
        id: match.player2Id,
        discordId: 'unknown',
        username: 'Unknown Player',
        elo: 0
      };
      
      return {
        ...match,
        league,
        player1: enrichedPlayer1,
        player2: enrichedPlayer2,
        // Keep the IDs directly accessible for backward compatibility
        player1Id: match.player1Id,
        player2Id: match.player2Id
      };
    } catch (error) {
      console.error('Error getting match with details:', error);
      throw error;
    }
  }

  /**
   * Find matches by league ID
   */
  async findByLeague(leagueId: string): Promise<Match[]> {
    return this.repository.find({
      where: { leagueId }
    });
  }

  /**
   * Find matches by player ID
   */
  async findByPlayer(playerId: string): Promise<Match[]> {
    return this.repository.find({
      where: [
        { player1Id: playerId },
        { player2Id: playerId }
      ]
    });
  }

  /**
   * Find matches by player ID and league ID
   */
  async findByPlayerAndLeague(playerId: string, leagueId: string): Promise<Match[]> {
    return this.repository.find({
      where: [
        { player1Id: playerId, leagueId },
        { player2Id: playerId, leagueId }
      ]
    });
  }

  /**
   * Find matches by player Discord ID and status
   */
  async findByPlayerDiscordIdAndStatus(discordId: string, status: MatchStatus): Promise<Match[]> {
    return this.findByPlayerDiscordId(discordId, status) as Promise<Match[]>;
  }

  /**
   * Find matches by player Discord ID and league ID
   */
  async findByPlayerDiscordIdAndLeagueId(discordId: string, leagueId: string): Promise<Match[]> {
    // First, find all players with this Discord ID in this league
    const playerRepo = await PlayerRepository.create();
    const players = await playerRepo.findByDiscordIdAndLeagueId(discordId, leagueId);
    
    if (!players || players.length === 0) {
      return [];
    }
    
    const playerIds = players.map((player: Player) => player.id);
    
    // Then find all matches where the player is a participant in this league
    return this.repository.find({
      where: [
        { player1Id: In(playerIds), leagueId },
        { player2Id: In(playerIds), leagueId }
      ]
    });
  }

  /**
   * Find matches by player Discord ID, league ID, and status
   */
  async findByPlayerDiscordIdAndLeagueIdAndStatus(discordId: string, leagueId: string, status: MatchStatus): Promise<Match[]> {
    // First, find all players with this Discord ID in this league
    const playerRepo = await PlayerRepository.create();
    const players = await playerRepo.findByDiscordIdAndLeagueId(discordId, leagueId);
    
    if (!players || players.length === 0) {
      return [];
    }
    
    const playerIds = players.map((player: Player) => player.id);
    
    // Then find all matches where the player is a participant in this league with the specified status
    return this.repository.find({
      where: [
        { player1Id: In(playerIds), leagueId, status },
        { player2Id: In(playerIds), leagueId, status }
      ]
    });
  }

  /**
   * Find matches by status
   */
  async findByStatus(status: MatchStatus): Promise<Match[]> {
    return this.repository.find({
      where: { status }
    });
  }

  /**
   * Find matches by status and league ID
   */
  async findByStatusAndLeague(status: MatchStatus, leagueId: string): Promise<Match[]> {
    return this.repository.find({
      where: { status, leagueId }
    });
  }
  
  /**
   * Find matches by criteria
   */
  async find(options: any): Promise<Match[]> {
    return this.repository.find(options);
  }
}
