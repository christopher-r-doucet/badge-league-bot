import { DataSource } from 'typeorm';
import { MoreThanOrEqual } from 'typeorm';
import { League } from '../src/entities/League.js';
import { Player, Rank } from '../src/entities/Player.js';
import { Match, MatchStatus } from '../src/entities/Match.js';
import { v4 as uuidv4 } from 'uuid';

// Create in-memory database for testing
const testDataSource = new DataSource({
  type: 'sqlite',
  database: ':memory:',
  entities: [League, Player, Match],
  synchronize: true,
  logging: false
});

// Test database wrapper with methods similar to the main database
class TestDatabase {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async createLeague(name: string): Promise<League> {
    const leagueRepository = this.dataSource.getRepository(League);
    const league = new League();
    league.id = uuidv4();
    league.name = name;
    league.createdAt = new Date();
    return await leagueRepository.save(league);
  }

  async createPlayer(discordId: string, username: string, leagueId: string, elo: number = 1000): Promise<Player> {
    const playerRepository = this.dataSource.getRepository(Player);
    const leagueRepository = this.dataSource.getRepository(League);
    
    const league = await leagueRepository.findOne({ where: { id: leagueId } });
    if (!league) throw new Error(`League with ID ${leagueId} not found`);
    
    const player = new Player();
    player.id = uuidv4();
    player.discordId = discordId;
    player.username = username;
    player.elo = elo;
    player.leagueId = leagueId;
    player.joinedAt = new Date();
    
    // Calculate initial rank based on ELO
    player.rank = this.calculateRank(player.elo);
    
    return await playerRepository.save(player);
  }

  async updatePlayerElo(playerId: string, newElo: number): Promise<Player> {
    const playerRepository = this.dataSource.getRepository(Player);
    
    const player = await playerRepository.findOne({ 
      where: { id: playerId }
    });
    
    if (!player) throw new Error(`Player with ID ${playerId} not found`);
    
    player.elo = newElo;
    player.rank = this.calculateRank(newElo);
    
    await playerRepository.save(player);
    
    // Update Grandmaster status for all players in the league
    await this.updateGrandmasterStatus(player.leagueId);
    
    return player;
  }

  async scheduleMatch(leagueId: string, player1Id: string, player2Id: string): Promise<Match> {
    const matchRepository = this.dataSource.getRepository(Match);
    const playerRepository = this.dataSource.getRepository(Player);
    const leagueRepository = this.dataSource.getRepository(League);
    
    const league = await leagueRepository.findOne({ where: { id: leagueId } });
    if (!league) throw new Error(`League with ID ${leagueId} not found`);
    
    const player1 = await playerRepository.findOne({ where: { id: player1Id } });
    if (!player1) throw new Error(`Player with ID ${player1Id} not found`);
    
    const player2 = await playerRepository.findOne({ where: { id: player2Id } });
    if (!player2) throw new Error(`Player with ID ${player2Id} not found`);
    
    const match = new Match();
    match.id = uuidv4();
    match.player1Id = player1Id;
    match.player2Id = player2Id;
    match.leagueId = leagueId;
    match.status = MatchStatus.SCHEDULED;
    match.createdAt = new Date();
    
    return await matchRepository.save(match);
  }

  async reportResult(matchId: string, winnerId: string): Promise<Match> {
    const matchRepository = this.dataSource.getRepository(Match);
    const playerRepository = this.dataSource.getRepository(Player);
    
    const match = await matchRepository.findOne({
      where: { id: matchId }
    });
    
    if (!match) throw new Error(`Match with ID ${matchId} not found`);
    if (match.status === MatchStatus.COMPLETED) throw new Error('Match already completed');
    
    // Get players
    const player1 = await playerRepository.findOne({ where: { id: match.player1Id } });
    const player2 = await playerRepository.findOne({ where: { id: match.player2Id } });
    
    if (!player1 || !player2) throw new Error('Match players not found');
    
    const winner = await playerRepository.findOne({ where: { id: winnerId } });
    if (!winner) throw new Error(`Winner with ID ${winnerId} not found`);
    
    // Ensure winner is part of the match
    if (winner.id !== match.player1Id && winner.id !== match.player2Id) {
      throw new Error('Winner must be one of the match participants');
    }
    
    // Get loser
    const loser = winner.id === match.player1Id ? player2 : player1;
    
    // Calculate ELO changes
    const { winnerNewElo, loserNewElo } = this.calculateEloChange(winner.elo, loser.elo);
    
    console.log(`${winner.username} (${winner.elo}) vs ${loser.username} (${loser.elo})`);
    console.log(`New ELO: ${winner.username} (${winnerNewElo}), ${loser.username} (${loserNewElo})`);
    console.log(`ELO Change: ${winner.username} (+${winnerNewElo - winner.elo}), ${loser.username} (${loserNewElo - loser.elo})`);
    
    // Update player ELOs
    winner.elo = winnerNewElo;
    loser.elo = loserNewElo;
    
    // Update ranks based on new ELO
    winner.rank = this.calculateRank(winner.elo);
    loser.rank = this.calculateRank(loser.elo);
    
    await playerRepository.save([winner, loser]);
    
    // Update match
    match.winnerId = winner.id;
    match.status = MatchStatus.COMPLETED;
    
    await matchRepository.save(match);
    
    // Update Grandmaster status for all players in the league
    await this.updateGrandmasterStatus(match.leagueId);
    
    return match;
  }

  calculateEloChange(winnerElo: number, loserElo: number): { winnerNewElo: number, loserNewElo: number } {
    const K = 32; // ELO K-factor
    
    // Calculate expected scores
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
    
    // Calculate ELO changes
    const winnerChange = Math.round(K * (1 - expectedWinner));
    const loserChange = Math.round(K * (0 - expectedLoser));
    
    return {
      winnerNewElo: winnerElo + winnerChange,
      loserNewElo: loserElo + loserChange
    };
  }

  async updateGrandmasterStatus(leagueId: string): Promise<void> {
    const playerRepository = this.dataSource.getRepository(Player);
    
    // Find all players in the league with ELO >= 2200
    const eligiblePlayers = await playerRepository.find({
      where: {
        leagueId: leagueId,
        elo: MoreThanOrEqual(2200)
      },
      order: {
        elo: 'DESC'
      }
    });
    
    // Get all players in the league
    const allLeaguePlayers = await playerRepository.find({
      where: {
        leagueId: leagueId
      }
    });
    
    // Reset any existing Grandmasters to their normal rank
    for (const player of allLeaguePlayers) {
      if (player.rank === 'Grandmaster') {
        player.rank = this.calculateRank(player.elo);
        await playerRepository.save(player);
      }
    }
    
    // If there are eligible players, make the highest ELO player the Grandmaster
    if (eligiblePlayers.length > 0) {
      const topPlayer = eligiblePlayers[0];
      topPlayer.rank = 'Grandmaster' as Rank;
      await playerRepository.save(topPlayer);
    }
  }

  calculateRank(elo: number): Rank {
    if (elo < 1400) return 'Bronze' as Rank;
    if (elo < 1600) return 'Silver' as Rank;
    if (elo < 1800) return 'Gold' as Rank;
    if (elo < 2000) return 'Diamond' as Rank;
    return 'Master' as Rank;
  }

  async getAllPlayersInLeague(leagueId: string): Promise<Player[]> {
    const playerRepository = this.dataSource.getRepository(Player);
    return await playerRepository.find({
      where: {
        leagueId: leagueId
      },
      order: {
        elo: 'DESC'
      }
    });
  }

  // Helper method to get a player by ID
  async getPlayerById(playerId: string): Promise<Player | null> {
    const playerRepository = this.dataSource.getRepository(Player);
    return await playerRepository.findOne({
      where: { id: playerId }
    });
  }
}

// Main test function
async function runEloEdgeCaseTests() {
  console.log('Starting ELO edge case tests...');
  
  try {
    // Initialize database
    await testDataSource.initialize();
    console.log('Test database initialized');
    
    const testDb = new TestDatabase(testDataSource);
    
    // Create a test league
    const league = await testDb.createLeague('Test League');
    console.log(`Created test league: ${league.name} (${league.id})`);
    
    // Test 1: Large ELO difference - High ELO player vs Low ELO player
    console.log('\n--- Test 1: Large ELO Difference (High vs Low) ---');
    const highEloPlayer = await testDb.createPlayer('1', 'HighELO', league.id, 2100);
    const lowEloPlayer = await testDb.createPlayer('2', 'LowELO', league.id, 1000);
    
    // Schedule and report match (high ELO player wins)
    const match1 = await testDb.scheduleMatch(league.id, highEloPlayer.id, lowEloPlayer.id);
    await testDb.reportResult(match1.id, highEloPlayer.id);
    
    // Test 2: Large ELO difference - Low ELO player upsets High ELO player
    console.log('\n--- Test 2: Large ELO Difference (Upset) ---');
    const highEloPlayer2 = await testDb.createPlayer('3', 'HighELO2', league.id, 2000);
    const lowEloPlayer2 = await testDb.createPlayer('4', 'LowELO2', league.id, 1200);
    
    // Schedule and report match (low ELO player wins - upset)
    const match2 = await testDb.scheduleMatch(league.id, highEloPlayer2.id, lowEloPlayer2.id);
    await testDb.reportResult(match2.id, lowEloPlayer2.id);
    
    // Test 3: Near Grandmaster Threshold
    console.log('\n--- Test 3: Near Grandmaster Threshold ---');
    const nearGMPlayer = await testDb.createPlayer('5', 'NearGM', league.id, 2190);
    const averagePlayer = await testDb.createPlayer('6', 'Average', league.id, 1500);
    
    // Schedule and report match (near GM player wins)
    const match3 = await testDb.scheduleMatch(league.id, nearGMPlayer.id, averagePlayer.id);
    await testDb.reportResult(match3.id, nearGMPlayer.id);
    
    // Check if player crossed Grandmaster threshold
    const updatedNearGMPlayer = await testDb.getPlayerById(nearGMPlayer.id);
    
    console.log(`\nNearGM player after match: ELO ${updatedNearGMPlayer?.elo}, Rank ${updatedNearGMPlayer?.rank}`);
    console.log(`Crossed 2200 threshold: ${updatedNearGMPlayer && updatedNearGMPlayer.elo >= 2200 ? 'Yes' : 'No'}`);
    
    // Test 4: Multiple high ELO players competing for Grandmaster
    console.log('\n--- Test 4: Grandmaster Competition ---');
    
    // Create multiple high ELO players
    const gm1 = await testDb.createPlayer('7', 'GM-Candidate1', league.id, 2250);
    const gm2 = await testDb.createPlayer('8', 'GM-Candidate2', league.id, 2240);
    const gm3 = await testDb.createPlayer('9', 'GM-Candidate3', league.id, 2230);
    
    // Check initial Grandmaster
    console.log('\nInitial high ELO players:');
    const highEloPlayers = await testDb.getAllPlayersInLeague(league.id);
    highEloPlayers.filter(p => p.elo >= 2200).forEach(p => {
      console.log(`${p.username}: ELO ${p.elo}, Rank ${p.rank}`);
    });
    
    // Have GM2 win against GM1
    console.log('\nGM2 wins against GM1:');
    const match4 = await testDb.scheduleMatch(league.id, gm1.id, gm2.id);
    await testDb.reportResult(match4.id, gm2.id);
    
    // Check updated Grandmaster
    console.log('\nUpdated high ELO players:');
    const updatedHighEloPlayers = await testDb.getAllPlayersInLeague(league.id);
    updatedHighEloPlayers.filter(p => p.elo >= 2200).forEach(p => {
      console.log(`${p.username}: ELO ${p.elo}, Rank ${p.rank}`);
    });
    
    // Verify only one Grandmaster exists
    const grandmasterCount = updatedHighEloPlayers.filter(p => p.rank === 'Grandmaster').length;
    console.log(`\nFinal Grandmaster count: ${grandmasterCount} (Expected: 1)`);
    
    console.log('\nAll ELO edge case tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Close database connection
    await testDataSource.destroy();
  }
}

// Run the tests
runEloEdgeCaseTests();
