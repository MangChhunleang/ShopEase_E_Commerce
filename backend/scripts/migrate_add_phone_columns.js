// Migration script to add phoneNumber and isPhoneVerified columns to User table
// Run with: node migrate_add_phone_columns.js

import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function migrate() {
  console.log('🔄 Starting migration: Add phone columns to User table');
  console.log('='.repeat(60));

  const conn = await getConnection();
  try {
    // Check if phoneNumber column exists
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'User' 
      AND COLUMN_NAME = 'phoneNumber'
    `);

    if (columns.length === 0) {
      console.log('📝 Adding phoneNumber column...');
      await conn.query(`ALTER TABLE User ADD COLUMN phoneNumber VARCHAR(20) UNIQUE`);
      console.log('✅ phoneNumber column added successfully');
    } else {
      console.log('✅ phoneNumber column already exists');
    }

    // Check if isPhoneVerified column exists
    const [verifiedColumns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'User' 
      AND COLUMN_NAME = 'isPhoneVerified'
    `);

    if (verifiedColumns.length === 0) {
      console.log('📝 Adding isPhoneVerified column...');
      await conn.query(`ALTER TABLE User ADD COLUMN isPhoneVerified BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('✅ isPhoneVerified column added successfully');
    } else {
      console.log('✅ isPhoneVerified column already exists');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('You can now use phone-based authentication.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

migrate()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });

