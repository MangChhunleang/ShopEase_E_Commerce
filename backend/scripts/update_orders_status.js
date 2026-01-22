import 'dotenv/config';
import { query, default as pool } from '../src/config/database.js';

const userId = process.argv[2];
const status = process.argv[3] || 'processing'; // Default to 'processing'

if (!userId) {
    console.error('❌ Please provide a user ID argument');
    console.log('Usage: node update_orders_status.js <userId> [status]');
    process.exit(1);
}

// Validate status
const validStatuses = ['pending', 'processing', 'delivered', 'expired', 'failed', 'cancelled'];
if (!validStatuses.includes(status)) {
    console.error(`❌ Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}`);
    process.exit(1);
}

async function updateOrders() {
    try {
        // 1. Verify user exists
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

        console.log(`Found ${count} orders. Updating status to '${status}'...`);

        // 3. Update orders
        // Verify specifically what we are updating. 
        // We will update ALL orders for this user to the new status.
        // We also ensure paymentMethod is 'Bakong' so the "Paid" badge shows up in UI testing, 
        // unless it's already a non-COD method. 
        // Actually, let's just stick to status for now to be safe, but maybe asking the user is better.
        // For now, I'll just update status.

        const updateResult = await query(
            'UPDATE `Order` SET status = ?, updatedAt = NOW() WHERE userId = ?',
            [status, userId]
        );

        console.log(`✅ Successfully updated ${updateResult.affectedRows} orders for user ${userId} to status '${status}'.`);

    } catch (error) {
        console.error('❌ Error executing update:', error);
    } finally {
        if (pool) await pool.end();
    }
}

updateOrders();
