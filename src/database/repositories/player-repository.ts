import { Repository, DataSource, MoreThanOrEqual, In } from 'typeorm';
import { Player, Rank } from '../../entities/Player.js';
import { League } from '../../entities/League.js';
import { BaseRepository, IBaseRepository } from './base-repository.js';
import { DatabaseConnection } from '../connection.js';

/**
 * Player repository interface
 */
export interface IPlayerRepository extends IBaseRepository<Player> {
  /**
   * Find players by Discord ID
   */
  findByDiscordId(discordId: string): Promise<Player[]>;
  
  /**
   * Find players by Discord ID and league ID
   */
  findByDiscordIdAndLeagueId(discordId: string, leagueId: string): Promise<Player[]>;
  
  /**
   * Find players by league ID
   */
  findByLeagueId(leagueId: string): Promise<Player[]>;
  
  /**
   * Find players by league name
   */
  findByLeagueName(leagueName: string): Promise<Player[]>;
  
  /**
   * Find players in a league with ELO >= specified value
   */
  findByLeagueIdAndMinElo(leagueId: string, minElo: number): Promise<Player[]>;
  
  /**
   * Get player stats for a Discord ID, optionally filtered by league
   */
  getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<Player | null>;
}

/**
 * Player repository implementation
 */
export class PlayerRepository extends BaseRepository<Player> implements IPlayerRepository {
  private leagueRepository: Repository<League>;
  
  private constructor(dataSource: DataSource) {
    super(dataSource.getRepository(Player));
    this.leagueRepository = dataSource.getRepository(League);
  }
  
  /**
   * Create a new player repository instance
   */
  static async create(): Promise<PlayerRepository> {
    const dataSource = await DatabaseConnection.getConnection();
    return new PlayerRepository(dataSource);
  }
  
  /**
   * Find players by Discord ID
   */
  async findByDiscordId(discordId: string): Promise<Player[]> {
    return this.repository.find({
      where: { discordId }
    });
  }
  
  /**
   * Find players by Discord ID and league ID
   */
  async findByDiscordIdAndLeagueId(discordId: string, leagueId: string): Promise<Player[]> {
    return this.repository.find({
      where: { 
        discordId,
        leagueId
      }
    });
  }
  
  /**
   * Find players by league ID
   */
  async findByLeagueId(leagueId: string): Promise<Player[]> {
    return this.repository.find({
      where: { leagueId }
    });
  }
  
  /**
   * Find players by league name
   */
  async findByLeagueName(leagueName: string): Promise<Player[]> {
    try {
      const league = await this.leagueRepository.findOne({ where: { name: leagueName } });
      
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }
      
      const players = await this.repository.find({ 
        where: { leagueId: league.id },
        order: { elo: 'DESC' }
      });
      
      return players;
    } catch (error) {
      console.error('Error getting players by league:', error);
      throw error;
    }
  }
  
  /**
   * Find players in a league with ELO >= specified value
   */
  async findByLeagueIdAndMinElo(leagueId: string, minElo: number): Promise<Player[]> {
    return this.repository.find({
      where: { 
        leagueId,
        elo: MoreThanOrEqual(minElo)
      },
      order: { elo: 'DESC' }
    });
  }
  
  /**
   * Get player stats for a Discord ID, optionally filtered by league
   */
  async getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<Player | null> {
    try {
      console.log(`Getting stats for player ${discordId}${leagueName ? ` in league ${leagueName}` : ''}`);
      
      // If league name is provided, get stats for that specific league
      if (leagueName) {
        // Find the league
        const league = await this.leagueRepository.findOne({ 
          where: { 
            name: leagueName,
            guildId
          } 
        });
        
        if (!league) {
          console.log(`League "${leagueName}" not found`);
          return null;
        }
        
        // Find the player in this league
        const player = await this.repository.findOne({ 
          where: { 
            discordId,
            leagueId: league.id
          } 
        });
        
        if (!player) {
          console.log(`Player ${discordId} not found in league "${leagueName}"`);
          return null;
        }
        
        // Add the league name to the player object
        player.leagueName = league.name;
        
        console.log(`Found stats for player ${discordId} in league "${leagueName}":`, player);
        return player;
      }
      
      // If no league name is provided, get the player's highest ranked league entry
      const player = await this.repository.findOne({ 
        where: { discordId },
        order: { elo: 'DESC' }
      });

      if (!player) {
        console.log(`No stats found for player ${discordId}`);
        return null;
      }

      // Get the league name for this player
      if (player.leagueId) {
        const league = await this.leagueRepository.findOne({
          where: { id: player.leagueId }
        });
        if (league) {
          player.leagueName = league.name;
        }
      }

      console.log(`Found stats for player ${discordId}:`, player);
      return player;
    } catch (error) {
      console.error('Error getting player stats:', error);
      throw error;
    }
  }
}
