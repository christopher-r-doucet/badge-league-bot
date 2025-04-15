import { Player } from '../entities/Player.js';

export interface ILeague {
  id: string;
  name: string;
  guildId: string;
  createdAt: Date;
}

export interface IPlayer {
  id: string;
  discordId: string;
  username: string;
  elo: number;
  rank: string;
  joinedAt: Date;
  league: ILeague;
}
