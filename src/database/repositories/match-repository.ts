import { Repository, DataSource, In } from 'typeorm';
import { Match, MatchStatus } from '../../entities/Match.js';
import { Player } from '../../entities/Player.js';
import { League } from '../../entities/League.js';
import { BaseRepository, IBaseRepository } from './base-repository.js';
import { DatabaseConnection } from '../connection.js';

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
   * Optionally filter by match status and guild ID
   */
  async findByPlayerDiscordId(discordId: string, status?: MatchStatus, guildId?: string): Promise<any[]> {
    try {
      console.log(`Getting matches for player with Discord ID: ${discordId}, status filter: ${status || 'none'}, guild filter: ${guildId || 'none'}`);

      // Find all player records for this Discord ID
      const players = await this.playerRepository.find({
        where: { discordId }
      });
      
      console.log(`Found ${players.length} player records for Discord ID: ${discordId}`);
      
      if (players.length === 0) {
        console.log(`No player records found for Discord ID: ${discordId}`);
        return [];
      }

      // Get player IDs
      const playerIds = players.map(player => player.id);
      console.log(`Player IDs: ${playerIds.join(', ')}`);

      // Build query for matches where the player is either player1 or player2
      let query = this.repository.createQueryBuilder('match')
        .where('(match.player1Id IN (:...playerIds) OR match.player2Id IN (:...playerIds))', { playerIds });
      
      // Add status filter if provided
      if (status) {
        query = query.andWhere('match.status = :status', { status });
      }
      
      // Order by scheduled date
      query = query.orderBy('match.scheduledDate', 'ASC');
      
      // Execute the query
      const matches = await query.getMany();
      console.log(`Found ${matches.length} matches for player(s) with Discord ID: ${discordId}`);

      // Enrich matches with player and league data
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const player1 = await this.playerRepository.findOne({ where: { id: match.player1Id } });
        const player2 = await this.playerRepository.findOne({ where: { id: match.player2Id } });
        const league = await this.leagueRepository.findOne({ where: { id: match.leagueId } });
        
        // Skip matches that don't belong to the specified guild
        if (guildId && league && league.guildId !== guildId) {
          return null;
        }
        
        // Ensure we have valid player objects with discordId
        const enrichedPlayer1 = player1 ? {
          ...player1,
          discordId: player1.discordId || 'unknown'
        } : null;
        
        const enrichedPlayer2 = player2 ? {
          ...player2,
          discordId: player2.discordId || 'unknown'
        } : null;
        
        return {
          ...match,
          league,
          player1: enrichedPlayer1,
          player2: enrichedPlayer2,
          // Keep the IDs directly accessible for backward compatibility
          player1Id: match.player1Id,
          player2Id: match.player2Id
        };
      }));

      // Filter out null values (matches from other guilds)
      const filteredMatches = enrichedMatches.filter(match => match !== null);
      console.log(`Returning ${filteredMatches.length} matches after filtering`);
      
      return filteredMatches;
    } catch (error) {
      console.error('Error getting player matches:', error);
      throw error;
    }
  }
  
  /**
   * Find matches by league name
   * Optionally filter by match status
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
      const match = await this.repository.findOne({
        where: { id: matchId }
      });
      
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
}
