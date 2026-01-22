import 'dotenv/config';
import { query, default as pool } from '../src/config/database.js';

async function listUsers() {
    try {
        const users = await query(`
      SELECT u.id, u.email, u.role, 
      (SELECT COUNT(*) FROM \`Order\` o WHERE o.userId = u.id) as orderCount 
      FROM User u
      ORDER BY u.id
    `);
        console.log(JSON.stringify(users, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        pool.end();
    }
}

listUsers();
