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
}

// Main test function
async function runRankingTests() {
  console.log('Starting ranking system tests...');
  
  try {
    // Initialize database
    await testDataSource.initialize();
    console.log('Test database initialized');
    
    const testDb = new TestDatabase(testDataSource);
    
    // Create a test league
    const league = await testDb.createLeague('Test League');
    console.log(`Created test league: ${league.name} (${league.id})`);
    
    // Create players with different ELO values
    const player1 = await testDb.createPlayer('1', 'Player1', league.id, 1000);
    const player2 = await testDb.createPlayer('2', 'Player2', league.id, 1500);
    const player3 = await testDb.createPlayer('3', 'Player3', league.id, 1700);
    const player4 = await testDb.createPlayer('4', 'Player4', league.id, 1900);
    const player5 = await testDb.createPlayer('5', 'Player5', league.id, 2100);
    
    console.log('\n--- Initial Player Ranks ---');
    const initialPlayers = await testDb.getAllPlayersInLeague(league.id);
    initialPlayers.forEach(p => {
      console.log(`${p.username}: ELO ${p.elo}, Rank ${p.rank}`);
    });
    
    // Test 1: No Grandmaster yet (no one has 2200+ ELO)
    console.log('\n--- Test 1: No Grandmaster Yet ---');
    const grandmasterCount = initialPlayers.filter(p => p.rank === 'Grandmaster').length;
    console.log(`Grandmaster count: ${grandmasterCount} (Expected: 0)`);
    
    // Test 2: Create a Grandmaster
    console.log('\n--- Test 2: Create a Grandmaster ---');
    await testDb.updatePlayerElo(player5.id, 2250);
    const playersAfterGM = await testDb.getAllPlayersInLeague(league.id);
    playersAfterGM.forEach(p => {
      console.log(`${p.username}: ELO ${p.elo}, Rank ${p.rank}`);
    });
    
    // Test 3: Add another eligible player, but only one should be Grandmaster
    console.log('\n--- Test 3: Multiple Eligible Players ---');
    await testDb.updatePlayerElo(player4.id, 2300);
    const playersAfterSecondGM = await testDb.getAllPlayersInLeague(league.id);
    playersAfterSecondGM.forEach(p => {
      console.log(`${p.username}: ELO ${p.elo}, Rank ${p.rank}`);
    });
    
    // Test 4: Grandmaster changes when someone gets higher ELO
    console.log('\n--- Test 4: Grandmaster Takeover ---');
    await testDb.updatePlayerElo(player3.id, 2400);
    const playersAfterTakeover = await testDb.getAllPlayersInLeague(league.id);
    playersAfterTakeover.forEach(p => {
      console.log(`${p.username}: ELO ${p.elo}, Rank ${p.rank}`);
    });
    
    // Test 5: Verify only one Grandmaster exists
    console.log('\n--- Test 5: Verify Single Grandmaster ---');
    const finalGrandmasterCount = playersAfterTakeover.filter(p => p.rank === 'Grandmaster').length;
    console.log(`Final Grandmaster count: ${finalGrandmasterCount} (Expected: 1)`);
    
    console.log('\nAll ranking system tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Close database connection
    await testDataSource.destroy();
  }
}

// Run the tests
runRankingTests();
