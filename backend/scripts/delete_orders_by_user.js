import 'dotenv/config';
import { query, default as pool } from '../src/config/database.js';

const userId = process.argv[2];

if (!userId) {
    console.error('❌ Please provide a user ID argument');
    console.log('Usage: node delete_orders_by_user.js <userId>');
    process.exit(1);
}

async function deleteOrders() {
    try {
        // 1. Verify user exists (optional, but good for feedback)
        const users = await query('SELECT email FROM User WHERE id = ?', [userId]);
        if (users.length === 0) {
            console.error(`❌ User with ID ${userId} not found.`);
            process.exit(1);
        }
        console.log(`User found: ${users[0].email}`);

        // 2. Count existing orders
        const countResult = await query('SELECT COUNT(*) as count FROM `Order` WHERE userId = ?', [userId]);
        const count = countResult[0].count;

        if (count === 0) {
            console.log(`ℹ️ No orders found for user ${userId}.`);
            process.exit(0);
        }

        console.log(`Found ${count} orders. Deleting...`);

        // 3. Delete orders
        // Note: OrderItem and OrderStatusHistory will be automatically deleted 
        // because of ON DELETE CASCADE constraints defined in init_db.js
        const deleteResult = await query('DELETE FROM `Order` WHERE userId = ?', [userId]);

        console.log(`✅ Successfully deleted ${deleteResult.affectedRows} orders for user ${userId}.`);

    } catch (error) {
        console.error('❌ Error executing deletion:', error);
    } finally {
        // Close database connection
        if (pool) await pool.end();
    }
}

deleteOrders();
