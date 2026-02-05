import 'dart:io';
import 'package:flutter/foundation.dart';

/// Centralized API configuration
/// 
/// This file contains the base URL for the backend API.
/// It automatically detects if running on Android Emulator or iOS Simulator.
class ApiConfig {
  // API base URL - points to Digital Ocean production server
  static String get apiBaseUrl {
    if (kIsWeb) {
      return 'http://24.199.101.185:4000';
    }
    
    if (Platform.isAndroid) {
      // Production server IP
      return 'http://24.199.101.185:4000';
    } else {
      // iOS simulator
      return 'http://24.199.101.185:4000';
    }
  }
  
  /// Convert a relative image URL to an absolute URL for the mobile app
  static String processImageUrl(String imageUrl) {
    if (imageUrl.isEmpty) {
      return imageUrl;
    }
    
    // Handle relative paths
    if (imageUrl.startsWith('/uploads/')) {
      return '$apiBaseUrl$imageUrl';
    }
    
    // Handle localhost and stale IP URLs (for development)
    if (imageUrl.contains('localhost:4000') || 
        imageUrl.contains('127.0.0.1:4000') ||
        imageUrl.contains('192.168.0.100:4000') ||
        imageUrl.contains('10.32.18.194:4000')) {
      return imageUrl
          .replaceAll('http://localhost:4000', apiBaseUrl)
          .replaceAll('https://localhost:4000', apiBaseUrl)
          .replaceAll('http://127.0.0.1:4000', apiBaseUrl)
          .replaceAll('https://127.0.0.1:4000', apiBaseUrl)
          .replaceAll('http://192.168.0.100:4000', apiBaseUrl)
          .replaceAll('https://192.168.0.100:4000', apiBaseUrl)
          .replaceAll('http://10.32.18.194:4000', apiBaseUrl)
          .replaceAll('https://10.32.18.194:4000', apiBaseUrl);
    }
    
    // Return as-is if already a full URL or asset path
    return imageUrl;
  }
}

