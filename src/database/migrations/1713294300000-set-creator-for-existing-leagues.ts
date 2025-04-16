import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetCreatorForExistingLeagues1713294300000 implements MigrationInterface {
    name = 'SetCreatorForExistingLeagues1713294300000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Admin user ID to set as default creator
        const adminUserId = '125313671906852864';
        
        // First, let's log how many leagues have null creatorId
        const nullCreatorCount = await queryRunner.query(`
            SELECT COUNT(*) FROM league WHERE "creatorId" IS NULL
        `);
        console.log(`Found ${nullCreatorCount[0].count} leagues with null creatorId`);

        // Set the admin user as creator for all leagues with null creatorId
        await queryRunner.query(`
            UPDATE league SET "creatorId" = $1 WHERE "creatorId" IS NULL
        `, [adminUserId]);
        
        console.log(`Set creatorId to ${adminUserId} for all leagues with null creatorId`);
        
        // Log how many leagues still have null creatorId (should be 0)
        const remainingNullCreatorCount = await queryRunner.query(`
            SELECT COUNT(*) FROM league WHERE "creatorId" IS NULL
        `);
        console.log(`After migration, ${remainingNullCreatorCount[0].count} leagues still have null creatorId`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration cannot be reversed safely
        console.log('This migration cannot be reversed');
    }
}
