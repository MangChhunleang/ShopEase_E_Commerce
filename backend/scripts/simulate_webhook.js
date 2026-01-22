
import axios from 'axios';

const API_URL = 'http://localhost:4000'; // Adjust if your backend runs on a different port

async function simulateWebhook() {
    try {
        const orderId = process.argv[2]; // Get order ID from command line argument

        if (!orderId) {
            console.error('Please provide an Order ID as an argument.');
            console.log('Usage: node simulate_webhook.js <orderId>');
            return;
        }

        console.log(`Simulating webhook for Order ID: ${orderId}...`);

        // Since we updated the backend to support orderId directly, we don't need to fetch details!
        const payload = {
            hash: `SIMULATED_TXN_${Date.now()}`,
            orderId: orderId, // Direct ID
            amount: 10000,
            currency: "KHR",
            status: "SUCCESS",
            txn_time: new Date().toISOString()
        };

        console.log('Sending webhook payload:', payload);

        const response = await axios.post(`${API_URL}/api/payments/bakong/webhook`, payload);

        console.log('Webhook Response:', response.data);
        console.log('✅ Payment Confirmed! Check the app now.');

    } catch (error) {
        console.error('Error simulating webhook:', error.response ? error.response.data : error.message);
    }
}

simulateWebhook();
