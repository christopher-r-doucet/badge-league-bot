import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { ILeague } from '../types/entities.js';

@Entity()
export class League implements ILeague {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  guildId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
