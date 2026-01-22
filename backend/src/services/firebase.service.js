import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
// We look for serviceAccountKey.json in the backend root directory
let firebaseApp = null;

try {
    const serviceAccountPath = join(__dirname, '../../serviceAccountKey.json');
    // Check if file exists first? No, requires 'fs', just try/catch read
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log('[Firebase] Admin SDK initialized successfully');
} catch (error) {
    console.warn('[Firebase] Failed to initialize Admin SDK:', error.message);
    console.warn('[Firebase] Phone auth verification will not work until serviceAccountKey.json is added.');
}

/**
 * Verify Firebase ID Token
 * @param {string} idToken - The ID token from the client app
 * @returns {Promise<{success: boolean, phoneNumber?: string, uid?: string, error?: string}>}
 */
export async function verifyFirebaseToken(idToken) {
    if (!firebaseApp) {
        return {
            success: false,
            error: 'Firebase Admin not initialized. Missing serviceAccountKey.json?'
        };
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // Check if it's a phone auth user
        if (!decodedToken.phone_number) {
            return {
                success: false,
                error: 'Token does not contain a phone number. Must use Phone Auth.'
            };
        }

        return {
            success: true,
            phoneNumber: decodedToken.phone_number,
            uid: decodedToken.uid
        };
    } catch (error) {
        console.error('Error verifying Firebase token:', error);
        return {
            success: false,
            error: 'Invalid or expired token'
        };
    }
}
