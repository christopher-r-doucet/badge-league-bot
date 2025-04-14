import { DataSource } from 'typeorm';
import { League } from '../entities/League.js';
import { Player } from '../entities/Player.js';
class Database {
    dataSource;
    constructor() {
        this.dataSource = new DataSource({
            type: 'sqlite',
            database: 'league.db',
            synchronize: true,
            entities: [League, Player],
            logging: ['error', 'warn']
        });
    }
    async init() {
        try {
            await this.dataSource.initialize();
            console.log('Database initialized successfully');
        }
        catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }
    async createLeague(name) {
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
        }
        catch (error) {
            console.error('Error creating league:', error);
            throw error;
        }
    }
    async addPlayerToLeague(interaction, discordId, leagueName) {
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
        }
        catch (error) {
            console.error('Error adding player to league:', error);
            throw error;
        }
    }
    async getLeagues() {
        try {
            console.log('Fetching leagues...');
            const leagueRepository = this.dataSource.getRepository(League);
            const leagues = await leagueRepository.find();
            console.log('Found leagues:', leagues);
            return leagues;
        }
        catch (error) {
            console.error('Error getting leagues:', error);
            throw error;
        }
    }
    async getLeagueStandings(leagueName) {
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
        }
        catch (error) {
            console.error('Error getting league standings:', error);
            throw error;
        }
    }
    async registerPlayer(discordId, username) {
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
        }
        catch (error) {
            console.error('Error registering player:', error);
            throw error;
        }
    }
    updatePlayerRank(player) {
        if (player.elo >= 2000)
            player.rank = 'Diamond';
        else if (player.elo >= 1800)
            player.rank = 'Platinum';
        else if (player.elo >= 1600)
            player.rank = 'Gold';
        else if (player.elo >= 1400)
            player.rank = 'Silver';
        else
            player.rank = 'Bronze';
    }
}
export const db = new Database();
