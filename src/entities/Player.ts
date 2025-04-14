import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';

@Entity()
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  discordId!: string;

  @Column()
  username!: string;

  @Column({ default: 1000 })
  elo!: number;

  @Column()
  rank!: string;

  @CreateDateColumn()
  joinedAt!: Date;

  @ManyToOne('League', 'players')
  league!: any;
}
