import { Player, Rank } from '../../entities/Player.js';
import { IPlayerRepository, PlayerRepository } from '../repositories/player-repository.js';
import { ILeagueRepository, LeagueRepository } from '../repositories/league-repository.js';
import { MoreThanOrEqual } from 'typeorm';

/**
 * Player service interface
 */
export interface IPlayerService {
  /**
   * Get a player by Discord ID and league name
   */
  getPlayer(discordId: string, leagueName: string, guildId?: string): Promise<Player | null>;
  
  /**
   * Get player stats
   */
  getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<Player | null>;
  
  /**
   * Get players in a league
   */
  getLeaguePlayers(leagueName: string): Promise<Player[]>;
  
  /**
   * Add a player to a league
   */
  addPlayerToLeague(discordId: string, username: string, leagueName: string, guildId: string): Promise<Player>;
  
  /**
   * Update player rank
   */
  updatePlayerRank(playerId: string): Promise<Player>;
  
  /**
   * Update player username
   */
  updatePlayerUsername(discordId: string, username: string): Promise<void>;
  
  /**
   * Check if a player is in a league
   */
  isPlayerInLeague(discordId: string, leagueName: string, guildId?: string): Promise<boolean>;
  
  /**
   * Get all leagues a player is in
   */
  getPlayerLeagues(discordId: string, guildId?: string): Promise<any[]>;
  
  /**
   * Remove a player from a league
   */
  removePlayerFromLeague(discordId: string, leagueId: string): Promise<boolean>;
}

/**
 * Player service implementation
 */
export class PlayerService implements IPlayerService {
  constructor(
    private playerRepository: IPlayerRepository,
    private leagueRepository: ILeagueRepository
  ) {}
  
  /**
   * Create a new player service instance
   */
  static async create(): Promise<PlayerService> {
    const playerRepo = await PlayerRepository.create();
    const leagueRepo = await LeagueRepository.create();
    
    return new PlayerService(playerRepo, leagueRepo);
  }
  
  /**
   * Get a player by Discord ID and league name
   */
  async getPlayer(discordId: string, leagueName: string, guildId?: string): Promise<Player | null> {
    try {
      // Find the league
      const league = await this.leagueRepository.findByNameAndGuildId(leagueName, guildId || '');
      
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }
      
      // Find player in this league
      const players = await this.playerRepository.findByDiscordIdAndLeagueId(discordId, league.id);
      
      if (!players || players.length === 0) {
        return null;
      }
      
      return players[0];
    } catch (error) {
      console.error('Error getting player:', error);
      throw error;
    }
  }
  
  /**
   * Get player stats
   */
  async getPlayerStats(discordId: string, leagueName?: string, guildId?: string): Promise<Player | null> {
    return this.playerRepository.getPlayerStats(discordId, leagueName, guildId);
  }
  
  /**
   * Get players in a league
   */
  async getLeaguePlayers(leagueName: string): Promise<Player[]> {
    return this.playerRepository.findByLeagueName(leagueName);
  }
  
  /**
   * Add a player to a league
   */
  async addPlayerToLeague(discordId: string, username: string, leagueName: string, guildId: string): Promise<Player> {
    try {
      // Find the league
      const league = await this.leagueRepository.findByNameAndGuildId(leagueName, guildId);
      
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }
      
      // Check if player already exists in this league
      const existingPlayers = await this.playerRepository.findByDiscordIdAndLeagueId(discordId, league.id);
      
      if (existingPlayers && existingPlayers.length > 0) {
        throw new Error(`You are already a member of the league "${leagueName}"`);
      }
      
      // Create new player
      const player = new Player();
      player.discordId = discordId;
      player.username = username;
      player.leagueId = league.id;
      player.elo = 1000; // Default starting ELO
      player.rank = 'Bronze'; // Default starting rank
      player.wins = 0;
      player.losses = 0;
      
      const savedPlayer = await this.playerRepository.save(player);
      return savedPlayer;
    } catch (error) {
      console.error('Error adding player to league:', error);
      throw error;
    }
  }
  
  /**
   * Update player rank
   */
  async updatePlayerRank(playerId: string): Promise<Player> {
    try {
      // Find the player
      const player = await this.playerRepository.findById(playerId);
      
      if (!player) {
        throw new Error('Player not found');
      }
      
      // Update rank based on ELO
      let calculatedRank: Rank;
      if (player.elo >= 2200) calculatedRank = 'Master'; // Default to Master for high ELO
      else if (player.elo >= 2000) calculatedRank = 'Master';
      else if (player.elo >= 1800) calculatedRank = 'Diamond';
      else if (player.elo >= 1600) calculatedRank = 'Gold';
      else if (player.elo >= 1400) calculatedRank = 'Silver';
      else calculatedRank = 'Bronze';
      
      // Assign the calculated rank
      player.rank = calculatedRank;
      
      // Special handling for Grandmaster - only the highest ELO player in a league can be Grandmaster
      if (player.elo >= 2200 && player.leagueId) {
        try {
          // Find all players in this league with ELO >= 2200, ordered by ELO descending
          const topPlayers = await this.playerRepository.findByLeagueIdAndMinElo(player.leagueId, 2200);
          
          // If this player has the highest ELO in the league among qualified players
          if (topPlayers.length > 0 && topPlayers[0].id === player.id) {
            player.rank = 'Grandmaster';
            
            // Demote any other Grandmasters in this league to Master
            if (topPlayers.length > 1) {
              for (let i = 1; i < topPlayers.length; i++) {
                if (topPlayers[i].rank === 'Grandmaster') {
                  topPlayers[i].rank = 'Master';
                  await this.playerRepository.save(topPlayers[i]);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error updating Grandmaster status:', error);
        }
      }
      
      // Save the player
      return await this.playerRepository.save(player);
    } catch (error) {
      console.error('Error updating player rank:', error);
      throw error;
    }
  }
  
  /**
   * Update player username
   */
  async updatePlayerUsername(discordId: string, username: string): Promise<void> {
    try {
      // Find all player records for this Discord ID
      const players = await this.playerRepository.findByDiscordId(discordId);
      
      if (!players || players.length === 0) {
        return; // No players to update
      }
      
      // Update username for all player records
      for (const player of players) {
        player.username = username;
        await this.playerRepository.save(player);
      }
    } catch (error) {
      console.error('Error updating player username:', error);
      throw error;
    }
  }
  
  /**
   * Check if a player is in a league
   */
  async isPlayerInLeague(discordId: string, leagueName: string, guildId?: string): Promise<boolean> {
    try {
      const player = await this.getPlayer(discordId, leagueName, guildId);
      return !!player;
    } catch (error) {
      console.error('Error checking if player is in league:', error);
      return false;
    }
  }
  
  /**
   * Get all leagues a player is in
   */
  async getPlayerLeagues(discordId: string, guildId?: string): Promise<any[]> {
    try {
      // Find all player records for this Discord ID
      const players = await this.playerRepository.findByDiscordId(discordId);
      
      if (!players || players.length === 0) {
        return [];
      }
      
      // Get league IDs
      const leagueIds = players.map(player => player.leagueId);
      
      // Get leagues
      const leagues = await Promise.all(
        leagueIds.map(async (leagueId) => {
          const league = await this.leagueRepository.findById(leagueId);
          return league;
        })
      );
      
      // Filter out null values and leagues from other guilds
      const filteredLeagues = leagues.filter(league => {
        if (!league) return false;
        if (guildId && league.guildId !== guildId) return false;
        return true;
      });
      
      return filteredLeagues;
    } catch (error) {
      console.error('Error getting player leagues:', error);
      throw error;
    }
  }
  
  /**
   * Remove a player from a league
   */
  async removePlayerFromLeague(discordId: string, leagueId: string): Promise<boolean> {
    try {
      // Find the player in this league
      const players = await this.playerRepository.findByDiscordIdAndLeagueId(discordId, leagueId);
      
      if (!players || players.length === 0) {
        console.log(`Player ${discordId} not found in league ${leagueId}`);
        return false;
      }
      
      // Remove the player from the league
      for (const player of players) {
        await this.playerRepository.remove(player);
      }
      
      console.log(`Player ${discordId} removed from league ${leagueId}`);
      return true;
    } catch (error) {
      console.error('Error removing player from league:', error);
      throw error;
    }
  }
}
