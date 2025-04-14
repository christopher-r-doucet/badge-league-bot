import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Master' | 'Grandmaster';

@Entity()
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  discordId: string;

  @Column()
  username: string;

  @Column({ default: 1000 })
  elo: number;

  @Column({ default: 'Bronze' })
  rank: Rank;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  losses: number;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  leagueId: string;

  get winRate(): number {
    const totalGames = this.wins + this.losses;
    if (totalGames === 0) return 0;
    return Math.round((this.wins / totalGames) * 100);
  }
}
