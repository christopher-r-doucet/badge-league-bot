import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Player } from './Player.js';
import type { ILeague } from '../types/entities.js';

@Entity()
export class League implements ILeague {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Player, (player) => player.league)
  players!: Player[];
}
