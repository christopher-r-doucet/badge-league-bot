import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity()
export class UserPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    discordId: string;

    @Column({ nullable: true })
    defaultLeagueId: string;

    @Column({ nullable: true })
    guildId: string;
}
