import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'core/services/cart_service.dart';
import 'core/services/wishlist_service.dart';
import 'core/services/order_service.dart';
import 'core/services/auth_service.dart';
import 'core/services/product_service.dart';
import 'core/services/category_service.dart';
import 'core/services/banner_service.dart';
import 'core/services/notification_service.dart';
import 'routes/app_routes.dart';
import 'features/home/screens/home_page.dart';
import 'features/auth/screens/auth_page.dart';
import 'core/firebase/firebase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await FirebaseService.initialize();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ShopEase',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const AuthWrapper(),
      routes: AppRoutes.getRoutes(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  final AuthService _authService = AuthService();
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _authService.addListener(_onAuthChanged);
    _initializeServices();
  }

  Future<void> _initializeServices() async {
    try {
      // Load local data in parallel
      await Future.wait([
        CartService().loadCart(),
        WishlistService().loadWishlist(),
        OrderService().loadOrders(),
        AuthService().loadAuth(),
        ProductService().loadCachedProducts(),
        CategoryService().loadCachedCategories(),
        BannerService().loadCachedBanners(),
        NotificationService().loadNotifications(),
      ]).timeout(const Duration(seconds: 10));

      // Sync from backend if authenticated (non-blocking)
      if (_authService.isAuthenticated) {
        WishlistService().syncFromBackend().catchError((e) {
          debugPrint('Wishlist sync error: $e');
        });
        OrderService().syncOrdersFromBackend().catchError((e) {
          debugPrint('Orders sync error: $e');
        });
      }
    } catch (e) {
      debugPrint('Error initializing services: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
    }
  }

  @override
  void dispose() {
    _authService.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_authService.isAuthenticated) {
      return const HomePage();
    } else {
      return const AuthPage();
    }
  }
}
