import 'dotenv/config';
import { query, default as pool } from '../src/config/database.js';

async function checkStatus() {
    try {
        console.log('Checking orders for user 7...');
        const rows = await query('SELECT id, orderNumber, status, paymentMethod, total FROM `Order` WHERE userId = 7 ORDER BY id DESC LIMIT 5');
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        if (pool) await pool.end();
    }
}

checkStatus();
