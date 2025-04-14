import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { League } from './League.js';
import { Player } from './Player.js';

@Entity()
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Player)
  player1!: Player;

  @ManyToOne(() => Player)
  player2!: Player;

  @ManyToOne(() => League)
  league!: League;

  @Column()
  status!: 'scheduled' | 'completed';

  @ManyToOne(() => Player, { nullable: true })
  winner!: Player | null;

  @CreateDateColumn()
  createdAt!: Date;
}
