import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Interface for Match entity to help TypeScript recognize all fields
export interface IMatch {
  id: string;
  leagueId: string;
  player1Id: string;
  player2Id: string;
  player1Score?: number;
  player2Score?: number;
  status: MatchStatus;
  winnerId?: string;
  loserId?: string;
  createdAt: Date;
  scheduledDate: Date | null;
  completedDate?: Date;
  isInstantMatch: boolean;
  player1Confirmed: boolean;
  player2Confirmed: boolean;
  player1Deck?: string;
  player2Deck?: string;
}

@Entity()
export class Match implements IMatch {
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
    type: 'varchar',
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

  @Column({ nullable: true })
  scheduledDate: Date | null;

  @Column({ nullable: true })
  completedDate: Date;

  @Column({ default: false })
  isInstantMatch: boolean;

  @Column({ default: false })
  player1Confirmed: boolean;

  @Column({ default: false })
  player2Confirmed: boolean;

  @Column({ nullable: true })
  player1Deck: string;

  @Column({ nullable: true })
  player2Deck: string;
}
