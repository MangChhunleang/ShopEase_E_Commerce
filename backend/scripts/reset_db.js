import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

// Drops all app tables and re-runs init_db.js to recreate schema and seed admin.
const tables = [
  'OrderStatusHistory',
  'Wishlist',
  'Review',
  'OrderItem',
  '`Order`',
  'Banner',
  'Category',
  'Product',
  'User',
];

const conn = await getConnection();
try {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of tables) {
    try {
      await conn.query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`Dropped table: ${table}`);
    } catch (err) {
      console.error(`Failed to drop table ${table}:`, err.message);
      throw err;
    }
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('All tables dropped. Running init_db.js to recreate schema...');
} catch (error) {
  console.error('Database reset failed:', error.message);
  process.exit(1);
} finally {
  conn.release();
}

try {
  await import('./init_db.js');
  console.log('Database reset complete. Admin user has been re-seeded.');
} catch (error) {
  console.error('Failed to recreate schema after drop:', error.message);
  process.exit(1);
}
