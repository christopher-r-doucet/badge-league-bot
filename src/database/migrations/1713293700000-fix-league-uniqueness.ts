import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixLeagueUniqueness1713293700000 implements MigrationInterface {
    name = 'FixLeagueUniqueness1713293700000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, drop the existing unique constraint on name if it exists
        try {
            await queryRunner.query(`
                ALTER TABLE "league" DROP CONSTRAINT IF EXISTS "UQ_110716368f5130cdc669dacea42"
            `);
        } catch (error) {
            console.log('No unique constraint to drop or error dropping it:', error);
        }

        // Find duplicate leagues within the same guild
        const duplicates = await queryRunner.query(`
            SELECT name, guild_id, COUNT(*) as count
            FROM league
            WHERE guild_id IS NOT NULL
            GROUP BY name, guild_id
            HAVING COUNT(*) > 1
        `);

        console.log(`Found ${duplicates.length} duplicate leagues within the same guild`);

        // For each duplicate set, keep the oldest one and delete the rest
        for (const { name, guild_id } of duplicates) {
            console.log(`Fixing duplicates for league "${name}" in guild "${guild_id}"`);
            
            // Get the oldest league with this name in this guild
            const oldestLeague = await queryRunner.query(`
                SELECT id
                FROM league
                WHERE name = $1 AND guild_id = $2
                ORDER BY created_at ASC
                LIMIT 1
            `, [name, guild_id]);
            
            if (oldestLeague.length > 0) {
                const oldestId = oldestLeague[0].id;
                
                // Delete all other leagues with the same name in the same guild
                await queryRunner.query(`
                    DELETE FROM league
                    WHERE name = $1 AND guild_id = $2 AND id != $3
                `, [name, guild_id, oldestId]);
                
                console.log(`Kept league ${oldestId} and removed duplicates`);
            }
        }

        // Now add the composite unique constraint
        await queryRunner.query(`
            ALTER TABLE "league" ADD CONSTRAINT "UQ_league_name_guild" UNIQUE ("name", "guild_id")
        `);
        
        console.log('Added composite unique constraint on name and guild_id');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the composite unique constraint
        await queryRunner.query(`
            ALTER TABLE "league" DROP CONSTRAINT IF EXISTS "UQ_league_name_guild"
        `);
        
        // We don't restore the old unique constraint on just name
    }
}
