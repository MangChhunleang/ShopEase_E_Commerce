/**
 * Migration Script: Add Bakong Payment Method
 * 
 * This script adds 'Bakong' to the paymentMethod ENUM in the Order table.
 * Run this script if you have an existing database and need to add Bakong support.
 * 
 * Usage: node migrate_add_bakong_payment.js
 */

import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function migrate() {
  const conn = await getConnection();
  
  try {
    console.log('🔄 Starting migration: Adding Bakong to paymentMethod ENUM...');
    
    // Check current ENUM values
    const [currentEnum] = await conn.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Order' 
      AND COLUMN_NAME = 'paymentMethod'
    `);
    
    if (currentEnum && currentEnum.length > 0) {
      const currentType = currentEnum[0].COLUMN_TYPE;
      console.log('📋 Current paymentMethod type:', currentType);
      
      // Check if Bakong already exists
      if (currentType.includes("'Bakong'")) {
        console.log('✅ Bakong already exists in paymentMethod ENUM. No migration needed.');
        return;
      }
    }
    
    // Modify the ENUM to include Bakong
    await conn.query(`
      ALTER TABLE \`Order\` 
      MODIFY COLUMN paymentMethod ENUM('Cash on Delivery', 'ABA Pay', 'Bakong') NOT NULL
    `);
    
    console.log('✅ Successfully added Bakong to paymentMethod ENUM');
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
