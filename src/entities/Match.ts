import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@Entity()
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  leagueId: string;

  @Column()
  player1Id: string;

  @Column()
  player2Id: string;

  @Column({ nullable: true })
  player1Score: number;

  @Column({ nullable: true })
  player2Score: number;

  @Column({
    type: 'simple-enum',
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED
  })
  status: MatchStatus;

  @Column({ nullable: true })
  winnerId: string;

  @Column({ nullable: true })
  loserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  scheduledDate: Date | null;

  @Column({ nullable: true, type: 'datetime' })
  completedDate: Date;

  @Column({ default: false })
  isInstantMatch: boolean;

  @Column({ default: false })
  player1Confirmed: boolean;

  @Column({ default: false })
  player2Confirmed: boolean;
}
