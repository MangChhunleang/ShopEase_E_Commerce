/**
 * Bakong Payment Service
 * 
 * This service handles integration with Bakong Open API for payment processing.
 * Refactored to use 'bakong-khqr' library for reliable generation.
 */

import 'dotenv/config';
import { BakongKHQR, khqrData, MerchantInfo } from "bakong-khqr";
import axios from 'axios';
import https from 'https';
import crypto from 'crypto';

class BakongService {
  constructor() {
    this.token = process.env.BAKONG_ACCESS_TOKEN || process.env.BAKONG_TOKEN || '';
    this.merchantId = process.env.BAKONG_MERCHANT_ID || 'leang_hok@aclb'; // Fallback for dev
    this.merchantName = process.env.BAKONG_MERCHANT_NAME || 'ShopEase';
    this.merchantCity = process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh';
    this.baseUrl = process.env.BAKONG_BASE_URL || 'https://api-bakong.nbc.gov.kh/v1'; // Changed to .gov.kh (working endpoint)
  }

  /**
   * Generate KHQR (Cambodia QR) code for payment
   */
  async generateKHQR(paymentData) {
    try {
      const { amount, orderNumber, merchantName = this.merchantName, merchantCity = this.merchantCity } = paymentData;

      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      console.log('[BAKONG] Generating KHQR via library...');
      console.log(`[BAKONG] MerchantID: ${this.merchantId}, Name: ${merchantName}, City: ${merchantCity}`);

      // Optional data for the QR
      const optionalData = {
        currency: khqrData.currency.khr,
        amount: Number(amount),
        billNumber: orderNumber,
        mobileNumber: "",
        storeLabel: merchantName,
        terminalLabel: "ShopEase App",
        expirationTimestamp: Date.now() + (15 * 60 * 1000), // 15 mins
      };

      // Create MerchantInfo instance with robust defaults for a "Real App" look
      const validMerchantName = (merchantName && merchantName.length > 0) ? merchantName : "ShopEase Store";
      const validMerchantCity = (merchantCity && merchantCity.length > 0) ? merchantCity : "Phnom Penh";

      const merchantInfo = new MerchantInfo(
        this.merchantId,
        validMerchantName,
        validMerchantCity,
        "0", // latitude (optional)
        "0", // longitude (optional)
        optionalData
      );

      const khqr = new BakongKHQR();
      const response = khqr.generateMerchant(merchantInfo);

      if (!response || !response.data) {
        throw new Error("Library returned null or invalid data. Check inputs (Bakong Account ID).");
      }

      const khqrString = response.data.qr;
      const md5 = response.data.md5;

      console.log('[BAKONG] Generated KHQR String:', khqrString);

      // Structure return data to match local app expectations
      return {
        success: true,
        qrCode: {
          khqrString: khqrString,
          md5: md5,
          amount: amount,
          currency: 'KHR',
          merchantName: merchantName,
          orderNumber: orderNumber,
          expiryTime: new Date(optionalData.expirationTimestamp).toISOString(),
        },
        qrString: khqrString,
        expiryTime: new Date(optionalData.expirationTimestamp).toISOString(),
        expiresIn: 15 * 60,
        message: 'QR code generated via bakong-khqr library',
        source: 'library'
      };

    } catch (error) {
      console.error('[BAKONG] Error generating KHQR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate KHQR string (synchronous)
   * Used for generating MD5 hash for verification
   */
  generateKHQRString(paymentData) {
    try {
      const { amount, orderNumber, merchantName = this.merchantName, merchantCity = this.merchantCity } = paymentData;

      const optionalData = {
        currency: khqrData.currency.khr,
        amount: Number(amount),
        billNumber: orderNumber,
        mobileNumber: "",
        storeLabel: merchantName,
        terminalLabel: "ShopEase App",
        expirationTimestamp: Date.now() + (15 * 60 * 1000), // 15 minutes
      };

      const merchantInfo = new MerchantInfo(
        this.merchantId,
        merchantName,
        merchantCity,
        "0",
        "0",
        optionalData
      );

      const khqr = new BakongKHQR();
      const response = khqr.generateMerchant(merchantInfo);

      return response?.data?.qr;
    } catch (error) {
      console.error('[BAKONG] Error generating KHQR string:', error);
      return null;
    }
  }

  /**
   * Calculate MD5 hash of a string
   */
  generateMd5(data) {
    if (!data) return null;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Verify payment status
   */
  async verifyPayment(transactionId) {
    try {
      if (!this.token) {
        return { success: false, error: 'Bakong token not configured' };
      }

      console.log(`[BAKONG] Verifying transaction MD5: ${transactionId} with BaseURL: ${this.baseUrl}`);

      // Use axios as in the user's working snippet
      const verifyEndpoints = [
        `${this.baseUrl}/check_transaction_by_md5`
      ];

      // Clean up base URL to ensure we don't double stack /v1 if we want to try an alternative
      // But typically we should just trust the configured URL. 
      // If we wanted to be robust, we could check if baseUrl ends in /v1 and try without it, or vice versa.
      // For now, let's stick to the primary derived URL to avoid confusion in logs.

      let lastError;

      // Create HTTPS agent for development (disable SSL verification)
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false // TODO: Set to true in production
      });

      for (const url of verifyEndpoints) {
        try {
          console.log(`[BAKONG] Checking URL: ${url}`);
          const response = await axios.post(
            url,
            { md5: transactionId },
            {
              headers: { 'Authorization': `Bearer ${this.token}` },
              httpsAgent: httpsAgent,
              timeout: 300000 // 5 minutes timeout (increased from 30 seconds)
            }
          );

          console.log(`[BAKONG] API Response status: ${response.status}`);
          console.log(`[BAKONG] API Response data:`, JSON.stringify(response.data, null, 2));

          const { responseCode, data } = response.data;

          // Check if payment found - handle both object and array formats
          const paymentFound = (responseCode === 0 && data && (
            (Array.isArray(data) && data.length > 0 && data[0].hash) ||
            (typeof data === 'object' && !Array.isArray(data) && data.hash)
          ));

          if (paymentFound) {
            // Extract transaction data (handle both formats)
            const txData = Array.isArray(data) ? data[0] : data;

            console.log('[BAKONG] Payment verified via API');
            console.log(`[BAKONG] Transaction Hash: ${txData.hash}`);
            console.log(`[BAKONG] Amount: ${txData.amount} ${txData.currency}`);

            return {
              success: true,
              status: 'completed',
              transactionData: txData,
              message: 'Payment verified successfully'
            };
          } else if (responseCode === 0) {
            // API responded successfully but no payment found
            console.log('[BAKONG] Transaction not found (payment pending or not made)');
            return {
              success: false,
              error: 'Transaction not found'
            };
          }
        } catch (e) {
          console.error(`[BAKONG] Error checking ${url}:`, e.message);
          if (e.response) {
            console.error(`[BAKONG] API Error Details:`, JSON.stringify(e.response.data, null, 2));
          }
          lastError = e;
          // Continue to next endpoint
        }
      }

      // If we reach here, verification failed
      console.warn('[BAKONG] Verification failed. Last error:', lastError ? lastError.message : 'No valid response');

      // Return a soft error to allow manual checking
      return {
        success: false,
        error: 'Payment not found or API error'
      };

    } catch (error) {
      console.error('[BAKONG] verifyPayment fatal error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(webhookData, signature) {
    try {
      // 1. Verify signature if provided
      if (signature) {
        const isValid = this.verifyWebhookSignature(webhookData, signature);
        if (!isValid) {
          return { success: false, error: 'Invalid webhook signature' };
        }
      }

      // 2. Parse data
      // Structure depends on Bakong API but usually contains:
      // { hash, externalRef, amount, currency, status, ... }
      // Adapting to common KHQR webhook format

      const {
        hash, // Transaction hash/MD5
        external_ref, // Order number
        amount,
        currency,
        status,
        txn_time,
        orderId // Allow passing orderId directly for simulation/testing
      } = webhookData;

      return {
        success: true,
        orderNumber: external_ref,
        transactionId: hash,
        amount: amount,
        currency: currency,
        isPaid: status === 'SUCCESS' || status === 'COMPLETED',
        paymentStatus: status ? status.toLowerCase() : 'unknown',
        timestamp: txn_time,
        orderId: orderId // Pass it back
      };

    } catch (error) {
      console.error('[BAKONG] Webhook handling error:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper for webhook signature verification
  verifyWebhookSignature(webhookData, signature) {
    try {
      const secret = process.env.BAKONG_API_SECRET;
      if (!secret) {
        console.warn('[BAKONG] Webhook signature verification skipped: BAKONG_API_SECRET not set');
        return true; // Skip if no secret configured
      }

      // Generate HMAC-SHA512 of the payload
      // Note: Actual logic depends on Bakong's specific signing method.
      // Standard approach: HMAC-SHA512(JSON string)
      const payload = typeof webhookData === 'string' ? webhookData : JSON.stringify(webhookData);

      const expectedSignature = crypto
        .createHmac('sha512', secret)
        .update(payload)
        .digest('hex');

      // Secure comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        console.warn(`[BAKONG] Invalid signature. Received: ${signature}, Expected: ${expectedSignature}`);
      }

      return isValid;
    } catch (error) {
      console.error('[BAKONG] Signature verification error:', error);
      return false;
    }
  }

  convertUSDToKHR(usdAmount) {
    const exchangeRate = process.env.USD_TO_KHR_RATE || 4000;
    return Math.round(usdAmount * exchangeRate);
  }
}

export default new BakongService();
