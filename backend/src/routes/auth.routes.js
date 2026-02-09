// routes/auth.routes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { verifyFirebaseToken } from '../services/firebase.service.js';
import { query } from '../config/database.js';

const router = express.Router();

// Email/Password Login for Admin Dashboard
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        error: 'Email and password are required'
      });
    }

    // Find user by email
    const users = await query('SELECT * FROM User WHERE email = ? LIMIT 1', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      role: user.role,
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'Internal server error'
    });
  }
});

// Firebase Phone Authentication Login

router.post('/firebase-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    console.log('[Firebase-Login] Request received');
    console.log('[Firebase-Login] Request body keys:', Object.keys(req.body));
    console.log('[Firebase-Login] ID Token received:', idToken ? `Yes (${idToken.length} chars)` : 'No');
    if (idToken) {
      console.log('[Firebase-Login] Token preview:', idToken.substring(0, Math.min(50, idToken.length)));
    }

    if (!idToken) {
      console.log('[Firebase-Login] Missing ID token');
      return res.status(400).json({
        success: false,
        message: 'ID Token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    console.log('[Firebase-Login] Verifying token with Firebase...');
    const result = await verifyFirebaseToken(idToken);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.error || 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Token valid, get/create user
    const phoneNumber = result.phoneNumber;

    // Check if user exists
    let users = await query('SELECT * FROM User WHERE phoneNumber = ? LIMIT 1', [phoneNumber]);
    let user = users[0];

    if (!user) {
      // Create new user
      const tempEmail = `phone_${phoneNumber.replace(/[^0-9]/g, '')}@shopease.local`;
      const placeholderHash = '$2b$10$' + crypto.randomBytes(32).toString('base64').slice(0, 53);

      const insertResult = await query(
        'INSERT INTO User (email, passwordHash, phoneNumber, isPhoneVerified, role, createdAt, updatedAt) VALUES (?, ?, ?, TRUE, ?, NOW(), NOW())',
        [tempEmail, placeholderHash, phoneNumber, 'USER']
      );

      users = await query('SELECT * FROM User WHERE id = ? LIMIT 1', [insertResult.insertId]);
      user = users[0];
      console.log(`[Firebase] Created new user: ${phoneNumber} (ID: ${user.id})`);
    } else {
      // Update phone verification status if needed
      if (!user.isPhoneVerified) {
        await query('UPDATE User SET isPhoneVerified = TRUE, updatedAt = NOW() WHERE id = ?', [user.id]);
      }
    }

    // Generate App JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Firebase] Login success: ${phoneNumber}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      role: user.role,
      userId: user.id,
      phoneNumber: phoneNumber
    });

  } catch (error) {
    console.error('Error in firebase-login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Dev-only: Static phone login (bypass Firebase) - for local testing
router.post('/dev-login', async (req, res) => {
  try {
    const isDev =
      process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === 'true';
    if (!isDev) {
      return res.status(403).json({
        success: false,
        message: 'Dev login is disabled in production'
      });
    }

    const { phone } = req.body;
    const phoneNumber = phone
      ? String(phone).replace(RegExp(/[\s\-\(\)]/g), '').trim()
      : '';

    if (!phoneNumber || phoneNumber.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required (e.g. +855123456789 or 123456789)'
      });
    }

    const fullPhone =
      phoneNumber.startsWith('+') ? phoneNumber : `+855${phoneNumber}`;

    let users = await query('SELECT * FROM User WHERE phoneNumber = ? LIMIT 1', [fullPhone]);
    let user = users[0];

    if (!user) {
      const tempEmail = `phone_${fullPhone.replace(/[^0-9]/g, '')}@shopease.local`;
      const placeholderHash = '$2b$10$' + crypto.randomBytes(32).toString('base64').slice(0, 53);
      const insertResult = await query(
        'INSERT INTO User (email, passwordHash, phoneNumber, isPhoneVerified, role, createdAt, updatedAt) VALUES (?, ?, ?, TRUE, ?, NOW(), NOW())',
        [tempEmail, placeholderHash, fullPhone, 'USER']
      );
      users = await query('SELECT * FROM User WHERE id = ? LIMIT 1', [insertResult.insertId]);
      user = users[0];
      console.log(`[Dev-Login] Created new user: ${fullPhone} (ID: ${user.id})`);
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Dev login successful',
      token,
      role: user.role,
      userId: user.id,
      phoneNumber: fullPhone
    });
  } catch (error) {
    console.error('Error in dev-login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
