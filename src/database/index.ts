import { DataSource } from 'typeorm';
import { MoreThanOrEqual } from 'typeorm';
import { League } from '../entities/League.js';
import { Player } from '../entities/Player.js';
import { Match, MatchStatus } from '../entities/Match.js';
import type { Rank } from '../entities/Player.js';
import path from 'path';
import fs from 'fs';

class Database {
  private dataSource: DataSource;

  constructor() {
    // Determine database path based on environment
    let dbPath = 'league.db';
    
    // In production (Heroku), use DATABASE_URL if available
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DATABASE_URL) {
        console.log('Using PostgreSQL database from DATABASE_URL');
        
        // Parse the DATABASE_URL to extract connection details
        const databaseUrl = process.env.DATABASE_URL;
        console.log(`Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Log URL with password hidden
        
        this.dataSource = new DataSource({
          type: 'postgres',
          url: databaseUrl,
          ssl: {
            rejectUnauthorized: false
          },
          synchronize: true,
          entities: [League, Player, Match],
          logging: ['error', 'warn']
        });
        return;
      } else {
        // Fallback to SQLite in a more persistent location
        const dataDir = process.env.DATA_DIR || '/app/data';
        try {
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          dbPath = path.join(dataDir, 'league.db');
          console.log(`Using database path: ${dbPath}`);
        } catch (error) {
          console.error('Error creating data directory:', error);
          // Fallback to current directory
          dbPath = 'league.db';
          console.log(`Falling back to database path: ${dbPath}`);
        }
      }
    } else {
      console.log(`Using development database path: ${dbPath}`);
    }
    
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: dbPath,
      synchronize: true,
      entities: [League, Player, Match],
      logging: ['error', 'warn']
    });
  }

  async init() {
    try {
      await this.dataSource.initialize();
      console.log('Database initialized successfully');
      
      // Log some diagnostic information
      const leagueRepository = this.dataSource.getRepository(League);
      const leagues = await leagueRepository.find();
      console.log(`Found ${leagues.length} leagues in database`);
      
      // Create a test league if none exist and we're in development
      if (leagues.length === 0 && process.env.NODE_ENV === 'development') {
        console.log('Creating a test league...');
        const testLeague = new League();
        testLeague.name = 'Test League';
        testLeague.createdAt = new Date();
        await leagueRepository.save(testLeague);
        console.log('Test league created');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async createLeague(name: string, guildId: string): Promise<League> {
    try {
      console.log('Creating league:', name, 'for guild:', guildId);
      const leagueRepository = this.dataSource.getRepository(League);
      
      // Check if league already exists in this guild
      const existingLeague = await leagueRepository.findOne({ 
        where: { 
          name,
          guildId 
        } 
      });
      
      if (existingLeague) {
        console.log('League already exists in this guild:', existingLeague);
        throw new Error(`League "${name}" already exists in this server`);
      }

      // Create new league
      const league = leagueRepository.create({ name, guildId });
      const savedLeague = await leagueRepository.save(league);
      console.log('Created league:', savedLeague);
      return savedLeague;
    } catch (error) {
      console.error('Error creating league:', error);
      throw error;
    }
  }

  async addPlayerToLeague(discordId: string, username: string, leagueName: string, guildId: string): Promise<Player> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);
      
      const league = await leagueRepository.findOne({ 
        where: { 
          name: leagueName,
          guildId
        } 
      });
      
      if (!league) {
        throw new Error(`League "${leagueName}" not found in this server`);
      }
      
      // Check if player already exists in this league
      const existingPlayer = await playerRepository.findOne({ 
        where: { 
          discordId,
          leagueId: league.id
        } 
      });
      
      if (existingPlayer) {
        throw new Error(`Player is already in league "${leagueName}"`);
      }
      
      // Create new player
      const player = new Player();
      player.discordId = discordId;
      player.username = username;
      player.leagueId = league.id;
      
      const savedPlayer = await playerRepository.save(player);
      return savedPlayer;
    } catch (error) {
      console.error('Error adding player to league:', error);
      throw error;
    }
  }

  async getLeagues(guildId?: string): Promise<League[]> {
    try {
      console.log('Fetching leagues for guild:', guildId || 'all guilds');
      const leagueRepository = this.dataSource.getRepository(League);
      
      // If guildId is provided, filter leagues by guild
      const whereCondition = guildId ? { guildId } : {};
      
      const leagues = await leagueRepository.find({
        where: whereCondition
      });
      
      console.log(`Found ${leagues.length} leagues`);
      return leagues;
    } catch (error) {
      console.error('Error getting leagues:', error);
      throw error;
    }
  }

  async getLeagueStandings(leagueName: string): Promise<Player[] | null> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);

      const league = await leagueRepository.findOne({ where: { name: leagueName } });
      if (!league) {
        return null;
      }

      const players = await playerRepository.find({
        where: { leagueId: league.id },
        order: { elo: 'DESC' }
      });

      return players;
    } catch (error) {
      console.error('Error getting league standings:', error);
      throw error;
    }
  }

  async registerPlayer(discordId: string, username: string): Promise<Player> {
    try {
      const playerRepository = this.dataSource.getRepository(Player);
      
      // Check if player is already registered
      const existingPlayer = await playerRepository.findOne({ where: { discordId } });
      if (existingPlayer) {
        throw new Error('You are already registered');
      }

      // Create new player
      const player = playerRepository.create({
        discordId,
        username,
        elo: 1000,
        rank: 'Bronze'
      });

      const savedPlayer = await playerRepository.save(player);
      console.log('Registered player:', savedPlayer);
      return savedPlayer;
    } catch (error) {
      console.error('Error registering player:', error);
      throw error;
    }
  }

  async getPlayerStats(discordId: string): Promise<Player | null> {
    try {
      console.log(`Getting stats for player ${discordId}`);
      const playerRepository = this.dataSource.getRepository(Player);
      
      const player = await playerRepository.findOne({ 
        where: { discordId },
        order: { elo: 'DESC' }  // Get their highest ranked league entry
      });

      if (!player) {
        console.log(`No stats found for player ${discordId}`);
        return null;
      }

      console.log(`Found stats for player ${discordId}:`, player);
      return player;
    } catch (error) {
      console.error('Error getting player stats:', error);
      throw error;
    }
  }

  async invitePlayerToLeague(leagueName: string, inviterId: string, inviteeId: string): Promise<{ league: League, inviter: Player | null }> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the league
      const league = await leagueRepository.findOne({ 
        where: { name: leagueName }
      });

      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      // Find the inviter in this league
      const inviter = await playerRepository.findOne({
        where: { 
          discordId: inviterId,
          leagueId: league.id
        }
      });

      if (!inviter) {
        throw new Error('You must be a member of this league to invite others');
      }

      // Check if invitee is already in the league
      const existingInvitee = await playerRepository.findOne({
        where: { 
          discordId: inviteeId,
          leagueId: league.id
        }
      });

      if (existingInvitee) {
        throw new Error('This player is already in the league');
      }

      return { league, inviter };
    } catch (error) {
      console.error('Error inviting player to league:', error);
      throw error;
    }
  }

  async getPlayersByLeague(leagueName: string): Promise<Player[]> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);
      
      const league = await leagueRepository.findOne({ where: { name: leagueName } });
      
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }
      
      const players = await playerRepository.find({ 
        where: { leagueId: league.id } 
      });
      
      return players;
    } catch (error) {
      console.error('Error getting players by league:', error);
      throw error;
    }
  }

  async getPlayerCountByLeague(leagueName: string): Promise<number> {
    try {
      const players = await this.getPlayersByLeague(leagueName);
      return players.length;
    } catch (error) {
      console.error('Error getting player count by league:', error);
      return 0;
    }
  }

  // Match-related methods
  async scheduleMatch(leagueName: string, player1Id: string, player2Id: string, guildId: string, scheduledDate?: Date): Promise<Match> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);
      const matchRepository = this.dataSource.getRepository(Match);

      // Find the league
      const league = await leagueRepository.findOne({ 
        where: { 
          name: leagueName,
          guildId
        }
      });

      if (!league) {
        throw new Error(`League "${leagueName}" not found in this server`);
      }

      // Find player 1
      const player1 = await playerRepository.findOne({
        where: { 
          discordId: player1Id,
          leagueId: league.id
        }
      });

      if (!player1) {
        throw new Error('You must be a member of this league to schedule a match');
      }

      // Find player 2
      const player2 = await playerRepository.findOne({
        where: { 
          discordId: player2Id,
          leagueId: league.id
        }
      });

      if (!player2) {
        throw new Error('Your opponent must be a member of this league');
      }

      if (player1Id === player2Id) {
        throw new Error('You cannot schedule a match against yourself');
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

      const savedMatch = await matchRepository.save(match);
      return savedMatch;
    } catch (error) {
      console.error('Error scheduling match:', error);
      throw error;
    }
  }

  async getScheduledMatches(leagueName: string): Promise<any[]> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const matchRepository = this.dataSource.getRepository(Match);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the league
      const league = await leagueRepository.findOne({ 
        where: { name: leagueName }
      });

      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      // Find scheduled matches
      const matches = await matchRepository.find({
        where: { 
          leagueId: league.id,
          status: MatchStatus.SCHEDULED
        },
        order: { scheduledDate: 'ASC' }
      });

      // Enrich matches with player and league data
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const player1 = await playerRepository.findOne({ where: { id: match.player1Id } });
        const player2 = await playerRepository.findOne({ where: { id: match.player2Id } });
        
        return {
          ...match,
          league,
          player1,
          player2
        };
      }));

      return enrichedMatches;
    } catch (error) {
      console.error('Error getting scheduled matches:', error);
      throw error;
    }
  }

  async getPlayerMatches(discordId: string, status?: MatchStatus, guildId?: string): Promise<any[]> {
    try {
      const playerRepository = this.dataSource.getRepository(Player);
      const matchRepository = this.dataSource.getRepository(Match);
      const leagueRepository = this.dataSource.getRepository(League);

      // Find the player
      const player = await playerRepository.findOne({
        where: { discordId }
      });

      if (!player) {
        throw new Error('Player not found');
      }

      // Build query conditions for player
      const conditions: any = [
        { player1Id: player.id },
        { player2Id: player.id }
      ];

      if (status) {
        conditions[0].status = status;
        conditions[1].status = status;
      }

      // Find matches
      const matches = await matchRepository.find({
        where: conditions,
        order: { scheduledDate: 'ASC' }
      });

      // Enrich matches with player and league data
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const player1 = await playerRepository.findOne({ where: { id: match.player1Id } });
        const player2 = await playerRepository.findOne({ where: { id: match.player2Id } });
        const league = await leagueRepository.findOne({ where: { id: match.leagueId } });
        
        // Skip matches that don't belong to the specified guild
        if (guildId && league && league.guildId !== guildId) {
          return null;
        }
        
        return {
          ...match,
          league,
          player1,
          player2
        };
      }));

      // Filter out null values (matches from other guilds)
      return enrichedMatches.filter(match => match !== null);
    } catch (error) {
      console.error('Error getting player matches:', error);
      throw error;
    }
  }

  async getMatch(matchId: string): Promise<any | null> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const playerRepository = this.dataSource.getRepository(Player);
      const leagueRepository = this.dataSource.getRepository(League);
      
      const match = await matchRepository.findOne({
        where: { id: matchId }
      });
      
      if (!match) return null;
      
      // Get related entities
      const player1 = await playerRepository.findOne({ where: { id: match.player1Id } });
      const player2 = await playerRepository.findOne({ where: { id: match.player2Id } });
      const league = await leagueRepository.findOne({ where: { id: match.leagueId } });
      
      return {
        ...match,
        player1,
        player2,
        league
      };
    } catch (error) {
      console.error('Error getting match:', error);
      throw error;
    }
  }

  async confirmMatch(matchId: string, discordId: string): Promise<Match> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the match
      const match = await matchRepository.findOne({
        where: { id: matchId }
      });

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        throw new Error('This match is not in scheduled status');
      }

      // Find the player
      const player = await playerRepository.findOne({
        where: { discordId }
      });

      if (!player) {
        throw new Error('Player not found');
      }

      // Confirm based on player
      if (match.player1Id === player.id) {
        match.player1Confirmed = true;
      } else if (match.player2Id === player.id) {
        match.player2Confirmed = true;
      } else {
        throw new Error('You are not a participant in this match');
      }

      // Save the match
      const updatedMatch = await matchRepository.save(match);
      return updatedMatch;
    } catch (error) {
      console.error('Error confirming match:', error);
      throw error;
    }
  }

  async reportMatchResult(matchId: string, reporterId: string, player1Score: number, player2Score: number): Promise<Match> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the match
      const match = await matchRepository.findOne({
        where: { id: matchId }
      });

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        throw new Error('This match has already been completed or cancelled');
      }

      // Validate reporter
      const reporter = await playerRepository.findOne({
        where: { discordId: reporterId }
      });

      if (!reporter) {
        throw new Error('Reporter not found');
      }

      const isParticipant = match.player1Id === reporter.id || match.player2Id === reporter.id;
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
      const player1 = await playerRepository.findOne({ where: { id: match.player1Id } });
      const player2 = await playerRepository.findOne({ where: { id: match.player2Id } });
      
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
      await playerRepository.save(winner);
      await playerRepository.save(loser);

      // Save match
      const updatedMatch = await matchRepository.save(match);
      return updatedMatch;
    } catch (error) {
      console.error('Error reporting match result:', error);
      throw error;
    }
  }

  async cancelMatch(matchId: string, discordId: string): Promise<Match> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the match
      const match = await matchRepository.findOne({
        where: { id: matchId }
      });

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        throw new Error('This match is not in scheduled status');
      }

      // Find the player
      const player = await playerRepository.findOne({
        where: { discordId }
      });

      if (!player) {
        throw new Error('Player not found');
      }

      // Validate player is participant
      const isParticipant = match.player1Id === player.id || match.player2Id === player.id;
      if (!isParticipant) {
        throw new Error('Only match participants can cancel the match');
      }

      // Cancel match
      match.status = MatchStatus.CANCELLED;

      // Save the match
      const updatedMatch = await matchRepository.save(match);
      return updatedMatch;
    } catch (error) {
      console.error('Error cancelling match:', error);
      throw error;
    }
  }

  async getMatchesByPlayer(discordId: string): Promise<Match[]> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      
      // Find matches where the player is either player1 or player2
      const matches = await matchRepository.find({
        where: [
          { player1Id: discordId },
          { player2Id: discordId }
        ],
        order: {
          createdAt: 'DESC'
        }
      });
      
      return matches;
    } catch (error) {
      console.error('Error getting matches by player:', error);
      throw error;
    }
  }

  // Helper method to calculate ELO change
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
        const playerRepository = this.dataSource.getRepository(Player);
        
        // Find all players in this league with ELO >= 2200, ordered by ELO descending
        const topPlayers = await playerRepository.find({
          where: { 
            leagueId: player.leagueId,
            elo: MoreThanOrEqual(2200)
          },
          order: { elo: 'DESC' }
        });
        
        // If this player has the highest ELO in the league among qualified players
        if (topPlayers.length > 0 && topPlayers[0].id === player.id) {
          player.rank = 'Grandmaster';
          
          // Demote any other Grandmasters in this league to Master
          if (topPlayers.length > 1) {
            for (let i = 1; i < topPlayers.length; i++) {
              if (topPlayers[i].rank === 'Grandmaster') {
                topPlayers[i].rank = 'Master';
                await playerRepository.save(topPlayers[i]);
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

export const db = new Database();
