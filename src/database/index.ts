import { DataSource } from 'typeorm';
import { League } from '../entities/League.js';
import { Player } from '../entities/Player.js';
import { Match } from '../entities/Match.js';

class Database {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: 'league.db',
      synchronize: true,
      entities: [League, Player, Match],
      logging: ['error', 'warn']
    });
  }

  async init() {
    try {
      await this.dataSource.initialize();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async createLeague(name: string): Promise<League> {
    try {
      console.log('Creating league:', name);
      const leagueRepository = this.dataSource.getRepository(League);
      
      // Check if league already exists
      const existingLeague = await leagueRepository.findOne({ where: { name } });
      if (existingLeague) {
        console.log('League already exists:', existingLeague);
        throw new Error(`League "${name}" already exists`);
      }

      // Create new league
      const league = leagueRepository.create({ name });
      const savedLeague = await leagueRepository.save(league);
      console.log('Created league:', savedLeague);
      return savedLeague;
    } catch (error) {
      console.error('Error creating league:', error);
      throw error;
    }
  }

  async addPlayerToLeague(interaction: any, discordId: string, leagueName: string): Promise<void> {
    try {
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the league
      const league = await leagueRepository.findOne({ 
        where: { name: leagueName },
        relations: ['players']
      });

      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      // Check if player is already in the league
      const existingPlayer = await playerRepository.findOne({
        where: { 
          discordId,
          league: { id: league.id }
        }
      });

      if (existingPlayer) {
        throw new Error('You are already in this league');
      }

      // Create new player
      const player = playerRepository.create({
        discordId,
        username: interaction.user.username,
        elo: 1000,
        rank: 'Bronze',
        league
      });

      await playerRepository.save(player);
      console.log(`Added player ${discordId} to league ${leagueName}`);
    } catch (error) {
      console.error('Error adding player to league:', error);
      throw error;
    }
  }

  async getLeagues(): Promise<League[]> {
    try {
      console.log('Fetching leagues...');
      const leagueRepository = this.dataSource.getRepository(League);
      const leagues = await leagueRepository.find();
      console.log('Found leagues:', leagues);
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
        where: { league: { id: league.id } },
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

      return await playerRepository.save(player);
    } catch (error) {
      console.error('Error registering player:', error);
      throw error;
    }
  }

  async scheduleMatch(player1Id: string, player2Id: string, leagueName: string): Promise<Match> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const leagueRepository = this.dataSource.getRepository(League);
      const playerRepository = this.dataSource.getRepository(Player);

      // Find the league
      const league = await leagueRepository.findOne({ where: { name: leagueName } });
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      // Find both players
      const player1 = await playerRepository.findOne({ where: { discordId: player1Id } });
      const player2 = await playerRepository.findOne({ where: { discordId: player2Id } });

      if (!player1 || !player2) {
        throw new Error('One or both players are not registered');
      }

      // Create the match
      const match = matchRepository.create({
        player1,
        player2,
        league,
        status: 'scheduled'
      });

      return await matchRepository.save(match);
    } catch (error) {
      console.error('Error scheduling match:', error);
      throw error;
    }
  }

  async getScheduledMatches(leagueName: string): Promise<Match[]> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const league = await this.dataSource.getRepository(League).findOne({ 
        where: { name: leagueName } 
      });

      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      return await matchRepository.find({
        where: { 
          league: { id: league.id },
          status: 'scheduled'
        },
        relations: ['player1', 'player2']
      });
    } catch (error) {
      console.error('Error getting scheduled matches:', error);
      throw error;
    }
  }

  async reportMatch(player1Id: string, player2Id: string, leagueName: string, player1Won: boolean): Promise<void> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const playerRepository = this.dataSource.getRepository(Player);
      const leagueRepository = this.dataSource.getRepository(League);

      // Find the league
      const league = await leagueRepository.findOne({ where: { name: leagueName } });
      if (!league) {
        throw new Error(`League "${leagueName}" not found`);
      }

      // Find the match
      const match = await matchRepository.findOne({
        where: {
          league: { id: league.id },
          status: 'scheduled',
          player1: { discordId: player1Id },
          player2: { discordId: player2Id }
        },
        relations: ['player1', 'player2']
      });

      if (!match) {
        throw new Error('No scheduled match found between these players');
      }

      // Update player ELOs
      const winner = player1Won ? match.player1 : match.player2;
      const loser = player1Won ? match.player2 : match.player1;

      // Simple ELO calculation
      const expectedScore = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
      const eloChange = Math.round(32 * (1 - expectedScore));

      winner.elo += eloChange;
      loser.elo -= eloChange;

      // Update ranks based on new ELO
      this.updatePlayerRank(winner);
      this.updatePlayerRank(loser);

      // Save changes
      await playerRepository.save([winner, loser]);

      // Update match status
      match.status = 'completed';
      match.winner = winner;
      await matchRepository.save(match);
    } catch (error) {
      console.error('Error reporting match:', error);
      throw error;
    }
  }

  private updatePlayerRank(player: Player): void {
    if (player.elo >= 2000) player.rank = 'Diamond';
    else if (player.elo >= 1800) player.rank = 'Platinum';
    else if (player.elo >= 1600) player.rank = 'Gold';
    else if (player.elo >= 1400) player.rank = 'Silver';
    else player.rank = 'Bronze';
  }

  async getPlayerMatches(playerId: string, leagueName?: string): Promise<Match[]> {
    try {
      const matchRepository = this.dataSource.getRepository(Match);
      const query = matchRepository.createQueryBuilder('match')
        .leftJoinAndSelect('match.player1', 'player1')
        .leftJoinAndSelect('match.player2', 'player2')
        .leftJoinAndSelect('match.league', 'league')
        .where('(player1.discordId = :playerId OR player2.discordId = :playerId)', { playerId })
        .andWhere('match.status = :status', { status: 'scheduled' });

      if (leagueName) {
        query.andWhere('league.name = :leagueName', { leagueName });
      }

      return await query.getMany();
    } catch (error) {
      console.error('Error getting player matches:', error);
      throw error;
    }
  }

  async getPlayerStatus(playerId: string, leagueName?: string): Promise<any> {
    try {
      const playerRepository = this.dataSource.getRepository(Player);
      const matchRepository = this.dataSource.getRepository(Match);

      if (leagueName) {
        // Get status for specific league
        const player = await playerRepository.findOne({
          where: { 
            discordId: playerId,
            league: { name: leagueName }
          },
          relations: ['league']
        });

        if (!player) {
          return null;
        }

        const matches = await matchRepository.count({
          where: [
            { player1: { id: player.id }, status: 'completed' },
            { player2: { id: player.id }, status: 'completed' }
          ]
        });

        return {
          elo: player.elo,
          rank: player.rank,
          matchesPlayed: matches
        };
      } else {
        // Get overall status
        const player = await playerRepository.findOne({
          where: { discordId: playerId },
          relations: ['league']
        });

        if (!player) {
          return null;
        }

        const matches = await matchRepository.find({
          where: [
            { player1: { id: player.id }, status: 'completed' },
            { player2: { id: player.id }, status: 'completed' }
          ],
          relations: ['winner']
        });

        const totalMatches = matches.length;
        const wins = matches.filter(m => m.winner?.id === player.id).length;
        const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

        const leagues = await this.dataSource
          .getRepository(League)
          .createQueryBuilder('league')
          .innerJoin('league.players', 'player')
          .where('player.discordId = :playerId', { playerId })
          .getMany();

        return {
          totalMatches,
          winRate: Math.round(winRate * 10) / 10,
          activeLeagues: leagues.map(l => l.name)
        };
      }
    } catch (error) {
      console.error('Error getting player status:', error);
      throw error;
    }
  }
}

export const db = new Database();
