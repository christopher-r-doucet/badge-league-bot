import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class AddUserPreference1681596000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists to avoid errors
        const tableExists = await queryRunner.hasTable("user_preference");
        if (tableExists) {
            console.log("user_preference table already exists, skipping creation");
            return;
        }

        console.log("Creating user_preference table");
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
        console.log("user_preference table created successfully");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Dropping user_preference table");
        await queryRunner.dropTable("user_preference");
        console.log("user_preference table dropped successfully");
    }
}
