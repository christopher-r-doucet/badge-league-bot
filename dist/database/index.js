import { DataSource } from 'typeorm';
import { League } from '../entities/League';
import { Player } from '../entities/Player';
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
            const leagueRepository = this.dataSource.getRepository(League);
            // Check if league already exists
            const existingLeague = await leagueRepository.findOne({ where: { name } });
            if (existingLeague) {
                throw new Error(`League "${name}" already exists`);
            }
            // Create new league
            const league = leagueRepository.create({ name });
            await leagueRepository.save(league);
            console.log(`Created league: ${name}`);
            return league;
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
            const leagueRepository = this.dataSource.getRepository(League);
            return await leagueRepository.find();
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
}
export const db = new Database();
