import { DatabaseConnection } from './connection.js';
import { MatchRepository } from './repositories/match-repository.js';
import { PlayerRepository } from './repositories/player-repository.js';
import { LeagueRepository } from './repositories/league-repository.js';
import { UserPreferenceRepository } from './repositories/user-preference-repository.js';
import { MatchService } from './services/match-service.js';
import { PlayerService } from './services/player-service.js';
import { LeagueService } from './services/league-service.js';
import { UserPreferenceService } from './services/user-preference-service.js';
import { League } from '../entities/League.js';
/**
 * Database class that provides access to all repositories and services
 * This is a facade over the individual repositories and services
 */
export class Database {
    static matchServiceInstance;
    static playerServiceInstance;
    static leagueServiceInstance;
    static userPreferenceServiceInstance;
    static dataSource;
    static initialized = false;
    /**
     * Initialize the database connection
     */
    static async init() {
        if (this.initialized) {
            console.log('Database already initialized');
            return;
        }
        try {
            console.log('Initializing database connection...');
            this.dataSource = await DatabaseConnection.getConnection();
            // Log available entity metadata for debugging
            console.log(`Available entity metadata: ${this.dataSource.entityMetadatas.map(meta => meta.name).join(', ')}`);
            console.log('Database connection initialized');
            this.initialized = true;
        }
        catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }
    /**
     * Get the match service instance
     */
    static async getMatchService() {
        await this.ensureInitialized();
        if (!this.matchServiceInstance) {
            this.matchServiceInstance = await MatchService.create();
        }
        return this.matchServiceInstance;
    }
    /**
     * Get the player service instance
     */
    static async getPlayerService() {
        await this.ensureInitialized();
        if (!this.playerServiceInstance) {
            this.playerServiceInstance = await PlayerService.create();
        }
        return this.playerServiceInstance;
    }
    /**
     * Get the league service instance
     */
    static async getLeagueService() {
        await this.ensureInitialized();
        if (!this.leagueServiceInstance) {
            this.leagueServiceInstance = await LeagueService.create();
        }
        return this.leagueServiceInstance;
    }
    /**
     * Get the user preference service instance
     */
    static async getUserPreferenceService() {
        await this.ensureInitialized();
        if (!this.userPreferenceServiceInstance) {
            this.userPreferenceServiceInstance = await UserPreferenceService.create();
        }
        return this.userPreferenceServiceInstance;
    }
    /**
     * Ensure the database is initialized
     */
    static async ensureInitialized() {
        if (!this.initialized) {
            await this.init();
        }
    }
    // MATCH SERVICE METHODS
    /**
     * Get player matches
     */
    static async getPlayerMatches(discordId, status, guildId) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.getPlayerMatches(discordId, status, guildId);
    }
    /**
     * Get match by ID
     */
    static async getMatch(matchId) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.getMatch(matchId);
    }
    /**
     * Get scheduled matches
     */
    static async getScheduledMatches(leagueName) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.getScheduledMatches(leagueName);
    }
    /**
     * Schedule a match
     */
    static async scheduleMatch(leagueName, player1Id, player2Id, guildId, scheduledDate) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.scheduleMatch(leagueName, player1Id, player2Id, guildId, scheduledDate);
    }
    /**
     * Confirm a match
     */
    static async confirmMatch(matchId, discordId) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.confirmMatch(matchId, discordId);
    }
    /**
     * Report match result
     */
    static async reportMatchResult(matchId, reporterId, player1Score, player2Score) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.reportMatchResult(matchId, reporterId, player1Score, player2Score);
    }
    /**
     * Cancel a match
     */
    static async cancelMatch(matchId, discordId) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.cancelMatch(matchId, discordId);
    }
    /**
     * Get all active matches for a player in a specific league
     */
    static async getPlayerActiveMatches(discordId, leagueId) {
        await this.ensureInitialized();
        const matchService = await this.getMatchService();
        return matchService.getPlayerActiveMatches(discordId, leagueId);
    }
    // PLAYER SERVICE METHODS
    /**
     * Get a player by Discord ID and league name
     */
    static async getPlayer(discordId, leagueName, guildId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.getPlayer(discordId, leagueName, guildId);
    }
    /**
     * Get player stats
     */
    static async getPlayerStats(discordId, leagueName, guildId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.getPlayerStats(discordId, leagueName, guildId);
    }
    /**
     * Get players in a league
     */
    static async getLeaguePlayers(leagueName) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.getLeaguePlayers(leagueName);
    }
    /**
     * Add a player to a league
     */
    static async addPlayerToLeague(discordId, username, leagueName, guildId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.addPlayerToLeague(discordId, username, leagueName, guildId);
    }
    /**
     * Update player username
     */
    static async updatePlayerUsername(discordId, username) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.updatePlayerUsername(discordId, username);
    }
    /**
     * Update player rank
     */
    static async updatePlayerRank(playerId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.updatePlayerRank(playerId);
    }
    /**
     * Check if a player is in a league
     */
    static async isPlayerInLeague(discordId, leagueName, guildId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.isPlayerInLeague(discordId, leagueName, guildId);
    }
    /**
     * Get all leagues a player is in
     */
    static async getPlayerLeagues(discordId, guildId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.getPlayerLeagues(discordId, guildId);
    }
    /**
     * Remove a player from a league
     */
    static async removePlayerFromLeague(discordId, leagueId) {
        await this.ensureInitialized();
        const playerService = await this.getPlayerService();
        return playerService.removePlayerFromLeague(discordId, leagueId);
    }
    // LEAGUE SERVICE METHODS
    /**
     * Get all leagues in a guild
     */
    static async getGuildLeagues(guildId) {
        await this.ensureInitialized();
        try {
            const leagueService = await this.getLeagueService();
            return leagueService.getGuildLeagues(guildId);
        }
        catch (error) {
            console.error('Error getting guild leagues:', error);
            // Try to access the repository directly as a fallback
            try {
                if (!this.dataSource.isInitialized) {
                    await this.dataSource.initialize();
                }
                console.log('Attempting direct repository access for League entity');
                const leagueRepository = this.dataSource.getRepository(League);
                const query = leagueRepository.createQueryBuilder('league');
                if (guildId) {
                    query.where('league.guildId = :guildId', { guildId });
                }
                const leagues = await query.getMany();
                console.log(`Found ${leagues.length} leagues using direct repository access`);
                return leagues;
            }
            catch (fallbackError) {
                console.error('Fallback error getting leagues:', fallbackError);
                throw error; // Throw the original error
            }
        }
    }
    /**
     * Get a league by name and guild ID
     */
    static async getLeague(name, guildId) {
        await this.ensureInitialized();
        const leagueService = await this.getLeagueService();
        return leagueService.getLeague(name, guildId);
    }
    /**
     * Create a new league
     */
    static async createLeague(leagueData) {
        await this.ensureInitialized();
        const leagueService = await this.getLeagueService();
        return leagueService.createLeague(leagueData);
    }
    /**
     * Get league leaderboard
     */
    static async getLeagueLeaderboard(leagueName) {
        await this.ensureInitialized();
        const leagueService = await this.getLeagueService();
        return leagueService.getLeagueLeaderboard(leagueName);
    }
    /**
     * Delete a league (only if creator or admin, and no active matches)
     */
    static async deleteLeague(leagueId, discordId, guildId) {
        await this.ensureInitialized();
        const leagueService = await this.getLeagueService();
        return leagueService.deleteLeague(leagueId, discordId, guildId);
    }
    /**
     * Check if a user is the creator of a league
     */
    static async isLeagueCreator(leagueId, discordId) {
        await this.ensureInitialized();
        const leagueService = await this.getLeagueService();
        return leagueService.isLeagueCreator(leagueId, discordId);
    }
    /**
     * Get leagues created by a user
     */
    static async getCreatedLeagues(discordId, guildId) {
        await this.ensureInitialized();
        const leagueService = await this.getLeagueService();
        return leagueService.getCreatedLeagues(discordId, guildId);
    }
    // USER PREFERENCE METHODS
    /**
     * Get user preference
     */
    static async getUserPreference(discordId, guildId) {
        await this.ensureInitialized();
        const userPreferenceService = await this.getUserPreferenceService();
        return userPreferenceService.getUserPreference(discordId, guildId);
    }
    /**
     * Set default league for a user
     */
    static async setDefaultLeague(discordId, leagueName, guildId) {
        await this.ensureInitialized();
        const userPreferenceService = await this.getUserPreferenceService();
        return userPreferenceService.setDefaultLeague(discordId, leagueName, guildId);
    }
    /**
     * Get default league for a user
     */
    static async getDefaultLeague(discordId, guildId) {
        await this.ensureInitialized();
        const userPreferenceService = await this.getUserPreferenceService();
        return userPreferenceService.getDefaultLeague(discordId, guildId);
    }
}
// Export repositories and services for direct access
export { MatchRepository, PlayerRepository, LeagueRepository, UserPreferenceRepository, MatchService, PlayerService, LeagueService, UserPreferenceService };
// Export a default instance for backward compatibility
export const db = Database;
