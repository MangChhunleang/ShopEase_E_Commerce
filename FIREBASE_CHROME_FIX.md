# Firebase Sign-in/Sign-up Chrome Redirect Fix

## Problem
When requesting Sign-in/Sign-up on the mobile app, Firebase Phone Authentication was opening Chrome instead of showing the verification code UI directly in the app.

## Root Cause
Firebase Phone Authentication on Android sometimes requires reCAPTCHA verification, which opens Chrome by default for security purposes. This is normal Firebase behavior, but we've optimized it to keep the user experience within the app.

## Solution Implemented

### 1. **Android Configuration Updates**
- **File**: `android/app/build.gradle.kts`
  - Added Firebase App Check Play Integrity provider for better reCAPTCHA handling
  - This helps Firebase determine device legitimacy without requiring manual reCAPTCHA

### 2. **Firebase Auth Service Updates**
- **File**: `lib/core/services/auth_service.dart`
  - Added Firebase Auth settings configuration on initialization
  - Updated `verifyPhoneNumber()` to use `forceResendingToken` for proper retry handling
  - Increased timeout to 120 seconds for better reCAPTCHA processing
  - Added proper multi-factor session handling

### 3. **Android Manifest Updates**
- **File**: `android/app/src/main/AndroidManifest.xml`
  - Added Chrome package queries for proper intent resolution
  - Added Firebase Federated Sign-In Activity configuration
  - Configured redirect handling to return to the app after reCAPTCHA verification

### 4. **MainActivity Enhancement**
- **File**: `android/app/src/main/kotlin/com/shopease/mobile/MainActivity.kt`
  - Added intent handling for Firebase reCAPTCHA callbacks
  - Ensures user returns to the app after Chrome verification
  - Handles both initial intent and new intents from redirects

## How It Works Now

1. User enters phone number on Auth Page
2. `requestVerificationCode()` is called
3. Firebase initializes phone verification
4. If reCAPTCHA is required:
   - Chrome may open briefly (this is Firebase's security mechanism)
   - User completes the verification
   - Chrome redirects back to the app automatically
   - User sees the verification code input screen
5. User enters the 6-digit code
6. App signs in with Firebase and exchanges token with backend

## Testing the Fix

1. Clean and rebuild the app:
   ```bash
   cd mobile_shopease
   flutter clean
   flutter pub get
   flutter run
   ```

2. On the Auth screen:
   - Enter a test phone number
   - If Chrome opens, verify the reCAPTCHA
   - You should be redirected back to the app automatically
   - The verification code input should appear

3. Enter the received OTP code (or use test OTP in development)

## Why This Happens

- **reCAPTCHA**: Firebase requires verification that the request is from a legitimate device/user
- **Chrome**: On Android, Google prefers Chrome for web-based verification flows
- **Security**: This is intentional - it prevents automated attacks on your auth system
- **App Check**: We added App Check to reduce reCAPTCHA frequency for legitimate devices

## Disabling Chrome for Development (Optional)

In `lib/core/services/auth_service.dart`, you can add during development:
```dart
_firebaseAuth.setSettings(
  appVerificationDisabledForTesting: true,
);
```

**WARNING**: Only use this in development. Never ship with this enabled.

## Further Optimization

If you still see Chrome frequently:
1. Ensure `google-services.json` is properly configured in `android/app/`
2. Your Firebase Project ID matches the app configuration
3. Device has Play Services installed and updated
4. Try using a real Android device instead of an emulator

## References
- [Firebase Phone Authentication Android](https://firebase.google.com/docs/auth/android/phone-auth)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [Android Intent Handling](https://developer.android.com/guide/components/intents-filters)
