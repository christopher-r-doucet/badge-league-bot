import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { ILeague } from '../types/entities.js';

@Entity()
export class League implements ILeague {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  guildId!: string;

  @Column({ nullable: true })
  creatorId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
