import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class AddUserPreference1681596000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "user_preference",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "uuid"
                    },
                    {
                        name: "discord_id",
                        type: "varchar",
                        isNullable: false
                    },
                    {
                        name: "default_league_id",
                        type: "varchar",
                        isNullable: true
                    },
                    {
                        name: "guild_id",
                        type: "varchar",
                        isNullable: true
                    }
                ]
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("user_preference");
    }
}
