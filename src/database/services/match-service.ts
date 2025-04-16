import { Match, MatchStatus } from '../../entities/Match.js';
import { Player } from '../../entities/Player.js';
import { Rank } from '../../entities/Player.js';
import { IMatchRepository, MatchRepository } from '../repositories/match-repository.js';
import { IPlayerRepository, PlayerRepository } from '../repositories/player-repository.js';
import { ILeagueRepository, LeagueRepository } from '../repositories/league-repository.js';
import { MoreThanOrEqual } from 'typeorm';

/**
 * Match service interface
 */
export interface IMatchService {
  /**
   * Get matches for a player
   */
  getPlayerMatches(discordId: string, status?: MatchStatus, guildId?: string): Promise<any[]>;
  
  /**
   * Get a match by ID with all details
   */
  getMatch(matchId: string): Promise<any | null>;
  
  /**
   * Get scheduled matches for a league
   */
  getScheduledMatches(leagueName: string): Promise<any[]>;
  
  /**
   * Schedule a match between two players
   */
  scheduleMatch(leagueName: string, player1Id: string, player2Id: string, guildId: string, scheduledDate?: Date): Promise<Match>;
  
  /**
   * Confirm a match
   */
  confirmMatch(matchId: string, discordId: string): Promise<Match>;
  
  /**
   * Report a match result
   */
  reportMatchResult(matchId: string, reporterId: string, player1Score: number, player2Score: number): Promise<Match>;
  
  /**
   * Cancel a match
   */
  cancelMatch(matchId: string, discordId: string): Promise<Match>;
}

/**
 * Match service implementation
 */
export class MatchService implements IMatchService {
  constructor(
    private matchRepository: IMatchRepository,
    private playerRepository: IPlayerRepository,
    private leagueRepository: ILeagueRepository
  ) {}
  
  /**
   * Create a new match service instance
   */
  static async create(): Promise<MatchService> {
    const matchRepo = await MatchRepository.create();
    const playerRepo = await PlayerRepository.create();
    const leagueRepo = await LeagueRepository.create();
    
    return new MatchService(matchRepo, playerRepo, leagueRepo);
  }
  
  /**
   * Get matches for a player
   */
  async getPlayerMatches(discordId: string, status?: MatchStatus, guildId?: string): Promise<any[]> {
    return this.matchRepository.findByPlayerDiscordId(discordId, status, guildId);
  }
  
  /**
   * Get a match by ID with all details
   */
  async getMatch(matchId: string): Promise<any | null> {
    return this.matchRepository.findByIdWithDetails(matchId);
  }
  
  /**
   * Get scheduled matches for a league
   */
  async getScheduledMatches(leagueName: string): Promise<any[]> {
    return this.matchRepository.findByLeagueName(leagueName, MatchStatus.SCHEDULED);
  }
  
  /**
   * Schedule a match between two players
   */
  async scheduleMatch(leagueName: string, player1Id: string, player2Id: string, guildId: string, scheduledDate?: Date): Promise<Match> {
    try {
      // Find the league
      const leagues = await this.leagueRepository.findByGuildId(guildId);
      const league = leagues.find(l => l.name === leagueName);

      if (!league) {
        throw new Error(`League "${leagueName}" not found in this server`);
      }

      // Find both players
      const player1Records = await this.playerRepository.findByDiscordId(player1Id);
      const player2Records = await this.playerRepository.findByDiscordId(player2Id);
      
      // Find the specific player records for this league
      const player1 = player1Records.find(p => p.leagueId === league.id);
      const player2 = player2Records.find(p => p.leagueId === league.id);

      if (!player1) {
        throw new Error(`You are not a member of the league "${leagueName}"`);
      }

      if (!player2) {
        throw new Error(`Your opponent is not a member of the league "${leagueName}"`);
      }

      // Create the match
      const match = new Match();
      match.leagueId = league.id;
      match.player1Id = player1.id;
      match.player2Id = player2.id;
      match.status = MatchStatus.SCHEDULED;
      match.scheduledDate = scheduledDate || null;
      match.isInstantMatch = !scheduledDate;
      match.player1Confirmed = true;
      match.player2Confirmed = !scheduledDate ? false : true;

      const savedMatch = await this.matchRepository.save(match);
      return savedMatch;
    } catch (error) {
      console.error('Error scheduling match:', error);
      throw error;
    }
  }
  
  /**
   * Confirm a match
   */
  async confirmMatch(matchId: string, discordId: string): Promise<Match> {
    try {
      // Find the match
      const match = await this.matchRepository.findById(matchId);

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        throw new Error('This match is not in scheduled status');
      }

      // Find the player in the specific league for this match
      const players = await this.playerRepository.findByDiscordIdAndLeagueId(discordId, match.leagueId);
      
      if (!players || players.length === 0) {
        throw new Error('You are not a member of the league this match belongs to');
      }

      const player = players[0]; // Take the first player found in this league
      console.log(`Found player ${player.id} for Discord ID ${discordId} in league ${match.leagueId}`);

      // Validate player is participant
      const isPlayer1 = match.player1Id === player.id;
      const isPlayer2 = match.player2Id === player.id;
      
      if (!isPlayer1 && !isPlayer2) {
        console.log(`Player ${player.id} is not a participant in match ${matchId}`);
        console.log(`Match player1Id: ${match.player1Id}, player2Id: ${match.player2Id}`);
        throw new Error('Only match participants can confirm the match');
      }

      // Update confirmation status
      if (isPlayer1) {
        match.player1Confirmed = true;
      } else {
        match.player2Confirmed = true;
      }

      // Check if both players have confirmed
      if (match.player1Confirmed && match.player2Confirmed) {
        console.log(`Match ${matchId} fully confirmed by both players`);
        
        // If this is an instant match, it's ready to play immediately
        if (match.isInstantMatch) {
          match.scheduledDate = new Date(); // Set to current date/time
        }
      }

      // Save the match
      const updatedMatch = await this.matchRepository.save(match);
      return updatedMatch;
    } catch (error) {
      console.error('Error confirming match:', error);
      throw error;
    }
  }
  
  /**
   * Report a match result
   */
  async reportMatchResult(matchId: string, reporterId: string, player1Score: number, player2Score: number): Promise<Match> {
    try {
      // Find the match
      const match = await this.matchRepository.findById(matchId);

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        throw new Error('This match has already been completed or cancelled');
      }

      // Validate reporter
      const reporters = await this.playerRepository.findByDiscordIdAndLeagueId(reporterId, match.leagueId);

      if (!reporters || reporters.length === 0) {
        throw new Error('Reporter not found in this league');
      }

      const isParticipant = reporters.some(player => match.player1Id === player.id || match.player2Id === player.id);
      if (!isParticipant) {
        throw new Error('Only match participants can report results');
      }

      // Validate scores
      if (player1Score < 0 || player2Score < 0) {
        throw new Error('Scores cannot be negative');
      }

      if (player1Score === player2Score) {
        throw new Error('Match cannot end in a tie');
      }

      // Update match
      match.player1Score = player1Score;
      match.player2Score = player2Score;
      match.status = MatchStatus.COMPLETED;
      match.completedDate = new Date();

      // Find players
      const player1 = await this.playerRepository.findById(match.player1Id);
      const player2 = await this.playerRepository.findById(match.player2Id);
      
      if (!player1 || !player2) {
        throw new Error('Players not found');
      }

      // Determine winner and loser
      const player1Wins = player1Score > player2Score;
      const winner = player1Wins ? player1 : player2;
      const loser = player1Wins ? player2 : player1;
      match.winnerId = winner.id;
      match.loserId = loser.id;

      // Update player stats
      winner.wins += 1;
      loser.losses += 1;

      // Calculate ELO changes
      const eloChange = this.calculateEloChange(winner.elo, loser.elo);
      winner.elo += eloChange;
      loser.elo = Math.max(1, loser.elo - eloChange); // Prevent negative ELO

      // Update ranks
      await this.updatePlayerRank(winner);
      await this.updatePlayerRank(loser);

      // Save players
      await this.playerRepository.save(winner);
      await this.playerRepository.save(loser);

      // Save match
      const updatedMatch = await this.matchRepository.save(match);
      return updatedMatch;
    } catch (error) {
      console.error('Error reporting match result:', error);
      throw error;
    }
  }
  
  /**
   * Cancel a match
   */
  async cancelMatch(matchId: string, discordId: string): Promise<Match> {
    try {
      // Find the match
      const match = await this.matchRepository.findById(matchId);

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        throw new Error('This match is not in scheduled status');
      }

      console.log(`Cancelling match ${matchId} by user ${discordId} in league ${match.leagueId}`);

      // Find the player in the specific league for this match
      const players = await this.playerRepository.findByDiscordIdAndLeagueId(discordId, match.leagueId);
      
      if (!players || players.length === 0) {
        throw new Error('You are not a member of the league this match belongs to');
      }

      const player = players[0]; // Take the first player found in this league
      console.log(`Found player ${player.id} for Discord ID ${discordId} in league ${match.leagueId}`);

      // Validate player is participant
      const isParticipant = match.player1Id === player.id || match.player2Id === player.id;
      if (!isParticipant) {
        console.log(`Player ${player.id} is not a participant in match ${matchId}`);
        console.log(`Match player1Id: ${match.player1Id}, player2Id: ${match.player2Id}`);
        throw new Error('Only match participants can cancel the match');
      }

      // Cancel match
      match.status = MatchStatus.CANCELLED;
      console.log(`Match ${matchId} cancelled by player ${player.id}`);

      // Save the match
      const updatedMatch = await this.matchRepository.save(match);
      return updatedMatch;
    } catch (error) {
      console.error('Error cancelling match:', error);
      throw error;
    }
  }
  
  /**
   * Calculate ELO change
   * @private
   */
  private calculateEloChange(winnerElo: number, loserElo: number): number {
    const eloDiff = loserElo - winnerElo;
    const expectedScore = 1 / (1 + Math.pow(10, eloDiff / 400));
    const baseChange = 32 * (1 - expectedScore);
    
    // Adjust based on ELO difference (upset bonus)
    let adjustedChange = baseChange;
    if (eloDiff > 100) {
      // Upset bonus when lower-rated player wins
      adjustedChange = baseChange * 1.5;
    }
    
    return Math.round(adjustedChange);
  }
  
  /**
   * Update player rank based on ELO
   * @private
   */
  private async updatePlayerRank(player: Player): Promise<void> {
    // First, handle normal rank progression based on ELO
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
  }
}
