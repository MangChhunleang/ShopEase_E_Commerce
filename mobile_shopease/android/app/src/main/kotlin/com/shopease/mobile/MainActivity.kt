package com.shopease.mobile

import android.content.Intent
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Handle Firebase reCAPTCHA redirect back from Chrome
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Handle Firebase reCAPTCHA redirect back from Chrome
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        // Firebase reCAPTCHA redirects will return to this Activity
        // The Firebase SDK will automatically handle the authentication flow
        // This ensures the user stays in the app instead of being stuck in Chrome
    }
}
