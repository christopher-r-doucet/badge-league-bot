import { DataSource } from 'typeorm';
import { League, Player, Match } from '../types';

class Database {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: 'league.db',
      synchronize: true,
      entities: [
        // Will add entity definitions here
      ]
    });
  }

  async init() {
    await this.dataSource.initialize();
  }

  async createLeague(name: string): Promise<League> {
    const league = { 
      id: Math.random().toString(36).substring(7),
      name,
      createdAt: new Date(),
      players: []
    };
    // TODO: Implement actual database save
    return league;
  }

  async addPlayerToLeague(discordId: string, leagueName: string): Promise<void> {
    // TODO: Implement
  }

  async getLeagues(): Promise<League[]> {
    // TODO: Implement
    return [];
  }

  async getLeagueStandings(leagueName: string): Promise<Player[] | null> {
    // TODO: Implement
    return null;
  }
}

export const db = new Database();
