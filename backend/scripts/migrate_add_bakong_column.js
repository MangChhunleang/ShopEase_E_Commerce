import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function migrate() {
    const conn = await getConnection();
    try {
        console.log('🔄 Starting migration: Adding bakongTransactionId to Order table...');

        // check if column already exists
        const [columns] = await conn.query(`SHOW COLUMNS FROM \`Order\` LIKE 'bakongTransactionId'`);

        if (columns.length > 0) {
            console.log('⚠️ Column bakongTransactionId already exists. Skipping...');
        } else {
            await conn.query(`
        ALTER TABLE \`Order\` 
        ADD COLUMN bakongTransactionId VARCHAR(100) NULL AFTER userId
      `);
            console.log('✅ Successfully added bakongTransactionId column to Order table');
        }

        // Verify
        const [verify] = await conn.query(`SHOW COLUMNS FROM \`Order\` LIKE 'bakongTransactionId'`);
        if (verify.length > 0) {
            console.log('✅ Verification successful: Column exists.');
        } else {
            console.error('❌ Verification failed: Column does not exist.');
        }

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

migrate();
