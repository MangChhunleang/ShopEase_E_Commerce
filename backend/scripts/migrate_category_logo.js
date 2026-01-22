import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

const conn = await getConnection();
try {
  // Add logoUrl column to Category table if it doesn't exist
  try {
    await conn.query(`
      ALTER TABLE Category 
      ADD COLUMN logoUrl VARCHAR(500) NULL
    `);
    console.log('✅ Added logoUrl column to Category table');
  } catch (err) {
    if (err.message.includes('Duplicate column name')) {
      console.log('ℹ️  logoUrl column already exists in Category table');
    } else {
      throw err;
    }
  }

  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration error:', error);
  process.exit(1);
} finally {
  await conn.end();
}
