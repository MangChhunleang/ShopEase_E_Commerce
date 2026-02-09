import 'dart:io';
import 'package:flutter/foundation.dart';

/// Centralized API configuration
/// 
/// This file contains the base URL for the backend API.
/// It automatically detects if running on Android Emulator or iOS Simulator.
class ApiConfig {
  // Toggle this to force using the hosted backend even in debug
  static const bool useHostedBackendInDebug = true;

  // API base URL - in production and (optionally) in debug
  static String get apiBaseUrl {
    if (kDebugMode && !useHostedBackendInDebug) {
      if (kIsWeb) return 'http://localhost:4000';
      if (Platform.isAndroid) return 'http://10.0.2.2:4000';
      return 'http://localhost:4000';
    }
    // Hosted backend (used in production and when useHostedBackendInDebug is true)
    // NOTE: Using direct server IP to avoid any DNS issues from the emulator/device.
    return 'https://shopease-admi.me/api';
  }
  
  /// Convert a relative image URL to an absolute URL for the mobile app
  static String processImageUrl(String imageUrl) {
    if (imageUrl.isEmpty) {
      return imageUrl;
    }

    // If it's already an absolute URL or data/asset path, leave it as-is
    final lower = imageUrl.toLowerCase();
    if (lower.startsWith('http://') ||
        lower.startsWith('https://') ||
        lower.startsWith('data:') ||
        lower.startsWith('asset:')) {
      return imageUrl;
    }
    
    // Base domain for static assets (strip /api if present)
    final base = apiBaseUrl.replaceAll('/api', '');
    
    // Handle relative paths coming from the backend
    //
    // Admin panel sometimes stores paths starting with `/api/uploads/...`
    // (because it calls backend routes under /api), but the static files
    // are actually served from `/uploads/...`.
    if (imageUrl.startsWith('/api/uploads/')) {
      final cleanedPath = imageUrl.replaceFirst('/api', '');
      return '$base$cleanedPath';
    }

    // Normalize any "uploads/..." path to "/uploads/..."
    if (imageUrl.startsWith('uploads/')) {
      imageUrl = '/$imageUrl';
    }

    if (imageUrl.startsWith('/uploads/')) {
      return '$base$imageUrl';
    }
    
    // Handle localhost and stale IP URLs (for development)
    if (imageUrl.contains('localhost:4000') || 
        imageUrl.contains('127.0.0.1:4000') ||
        imageUrl.contains('192.168.0.100:4000') ||
        imageUrl.contains('10.32.18.194:4000') ||
        imageUrl.contains('24.199.101.185:4000')) {
      return imageUrl
          .replaceAll('http://localhost:4000', base)
          .replaceAll('https://localhost:4000', base)
          .replaceAll('http://127.0.0.1:4000', base)
          .replaceAll('https://127.0.0.1:4000', base)
          .replaceAll('http://192.168.0.100:4000', base)
          .replaceAll('https://192.168.0.100:4000', base)
          .replaceAll('http://10.32.18.194:4000', base)
          .replaceAll('https://10.32.18.194:4000', base)
          .replaceAll('http://24.199.101.185:4000', base)
          .replaceAll('https://24.199.101.185:4000', base);
    }
    
    // Return as-is if already a full URL or asset path
    return imageUrl;
  }
}

