import 'package:flutter/material.dart';
import '../features/home/screens/home_page.dart';
import '../features/auth/screens/auth_page.dart';
import '../features/auth/screens/test_login_page.dart';

/// App-wide route definitions
class AppRoutes {
  // Route names
  static const String home = '/home';
  static const String auth = '/auth';
  static const String testLogin = '/test-login';

  /// Get all routes for the app
  static Map<String, WidgetBuilder> getRoutes() {
    return {
      home: (context) => const HomePage(),
      auth: (context) => const AuthPage(),
      testLogin: (context) => const TestLoginPage(),
    };
  }
}
