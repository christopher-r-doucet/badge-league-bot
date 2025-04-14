export interface ILeague {
  id: string;
  name: string;
  createdAt: Date;
  players: IPlayer[];
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
