export interface League {
  id: string;
  name: string;
  createdAt: Date;
  players: Player[];
}

export interface Player {
  id: string;
  discordId: string;
  username: string;
  elo: number;
  rank: string;
}

export interface Match {
  id: string;
  leagueId: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  playedAt: Date | null;
}
