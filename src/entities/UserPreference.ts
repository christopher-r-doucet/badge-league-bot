import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class UserPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    discordId: string;

    @Column({ nullable: true })
    defaultLeagueId: string;

    @Column({ nullable: true })
    guildId: string;
}
