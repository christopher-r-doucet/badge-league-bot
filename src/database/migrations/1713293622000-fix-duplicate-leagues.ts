import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDuplicateLeagues1713293622000 implements MigrationInterface {
    name = 'FixDuplicateLeagues1713293622000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, find duplicate leagues
        const duplicates = await queryRunner.query(`
            SELECT name, COUNT(*) as count
            FROM league
            GROUP BY name
            HAVING COUNT(*) > 1
        `);

        // For each duplicate, keep the oldest one and delete the rest
        for (const { name } of duplicates) {
            await queryRunner.query(`
                DELETE FROM league
                WHERE name = $1
                AND id NOT IN (
                    SELECT id
                    FROM league
                    WHERE name = $1
                    ORDER BY created_at ASC
                    LIMIT 1
                )
            `, [name]);
        }

        // Now add the unique constraint
        await queryRunner.query(`
            ALTER TABLE league
            ADD CONSTRAINT UQ_league_name UNIQUE (name)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the unique constraint
        await queryRunner.query(`
            ALTER TABLE league
            DROP CONSTRAINT IF EXISTS UQ_league_name
        `);
    }
}
