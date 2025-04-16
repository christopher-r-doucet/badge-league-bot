import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';
import type { ILeague } from '../types/entities.js';

@Entity()
@Unique(['name', 'guildId'])
export class League implements ILeague {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  guildId!: string;

  @Column({ nullable: true })
  creatorId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
