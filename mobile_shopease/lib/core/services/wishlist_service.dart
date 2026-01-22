import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/cart_item.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class WishlistService extends ChangeNotifier {
  static final WishlistService _instance = WishlistService._internal();
  factory WishlistService() => _instance;
  WishlistService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;
  List<CartItem> _items = [];
  static const String _wishlistKey = 'wishlist_items';
  bool _isLoading = false;
  bool _isSyncing = false;

  List<CartItem> get items => List.unmodifiable(_items);
  bool get isEmpty => _items.isEmpty;
  bool get isLoading => _isLoading;
  bool get isSyncing => _isSyncing;

  // Load wishlist from local storage
  Future<void> loadWishlist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final wishlistJson = prefs.getString(_wishlistKey);
      if (wishlistJson != null) {
        final List<dynamic> decoded = json.decode(wishlistJson);
        _items = decoded.map((item) => CartItem.fromJson(item)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading wishlist: $e');
    }
  }

  // Sync wishlist from backend
  Future<void> syncFromBackend() async {
    final authService = AuthService();
    if (!authService.isAuthenticated || authService.token == null) {
      debugPrint('Not authenticated, skipping wishlist sync');
      return;
    }

    try {
      _isSyncing = true;
      notifyListeners();

      final response = await http.get(
        Uri.parse('$_apiBaseUrl/wishlist'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${authService.token}',
        },
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Connection timeout');
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> wishlistData = jsonDecode(response.body);
        _items = wishlistData.map((item) {
          // Convert backend wishlist item to CartItem
          final images = item['images'] is String 
              ? jsonDecode(item['images']) 
              : (item['images'] as List? ?? []);
          final imageUrl = images.isNotEmpty ? images[0] : '';
          
          return CartItem(
            id: item['productId'].toString(),
            name: item['name'] ?? '',
            imageUrl: _processImageUrl(imageUrl),
            price: '\$${item['price']?.toString() ?? '0.00'}',
            quantity: 1,
            color: null,
            offer: null,
          );
        }).toList();

        await _saveWishlist();
        debugPrint('Synced ${_items.length} items from backend wishlist');
        notifyListeners();
      } else if (response.statusCode == 401) {
        debugPrint('Unauthorized - token may be expired');
      } else {
        debugPrint('Failed to sync wishlist: ${response.statusCode}');
      }
    } on SocketException catch (e) {
      debugPrint('Network error syncing wishlist: $e');
    } catch (e) {
      debugPrint('Error syncing wishlist: $e');
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  // Process image URL for mobile app
  String _processImageUrl(String imageUrl) {
    return ApiConfig.processImageUrl(imageUrl);
  }

  Future<void> _saveWishlist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final wishlistJson = json.encode(_items.map((item) => item.toJson()).toList());
      await prefs.setString(_wishlistKey, wishlistJson);
    } catch (e) {
      debugPrint('Error saving wishlist: $e');
    }
  }

  // Add item to wishlist (syncs with backend if authenticated)
  Future<void> addItem(CartItem item) async {
    if (_items.any((i) => i.id == item.id)) {
      return; // Already in wishlist
    }

    _items.add(item);
    notifyListeners();
    await _saveWishlist();

    // Sync with backend if authenticated
    final authService = AuthService();
    if (authService.isAuthenticated && authService.token != null) {
      try {
        final productId = int.tryParse(item.id);
        if (productId != null) {
          final response = await http.post(
            Uri.parse('$_apiBaseUrl/wishlist'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${authService.token}',
            },
            body: jsonEncode({'productId': productId}),
          );

          if (response.statusCode == 201 || response.statusCode == 200) {
            debugPrint('Added product $productId to backend wishlist');
          } else if (response.statusCode == 400) {
            // Already in wishlist on backend, that's okay
            debugPrint('Product already in backend wishlist');
          }
        }
      } catch (e) {
        debugPrint('Error syncing add to backend: $e');
        // Continue even if backend sync fails
      }
    }
  }

  // Remove item from wishlist (syncs with backend if authenticated)
  Future<void> removeItem(String itemId) async {
    _items.removeWhere((item) => item.id == itemId);
    notifyListeners();
    await _saveWishlist();

    // Sync with backend if authenticated
    final authService = AuthService();
    if (authService.isAuthenticated && authService.token != null) {
      try {
        final productId = int.tryParse(itemId);
        if (productId != null) {
          final response = await http.delete(
            Uri.parse('$_apiBaseUrl/wishlist/$productId'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${authService.token}',
            },
          );

          if (response.statusCode == 200) {
            debugPrint('Removed product $productId from backend wishlist');
          }
        }
      } catch (e) {
        debugPrint('Error syncing remove to backend: $e');
        // Continue even if backend sync fails
      }
    }
  }

  Future<void> clearWishlist() async {
    _items.clear();
    notifyListeners();
    await _saveWishlist();
  }

  bool isInWishlist(String itemId) {
    return _items.any((item) => item.id == itemId);
  }

  // Check if product is in wishlist on backend
  Future<bool> isInWishlistBackend(int productId) async {
    final authService = AuthService();
    if (!authService.isAuthenticated || authService.token == null) {
      return isInWishlist(productId.toString());
    }

    try {
      final response = await http.get(
        Uri.parse('$_apiBaseUrl/wishlist/check/$productId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${authService.token}',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['inWishlist'] == true;
      }
    } catch (e) {
      debugPrint('Error checking wishlist on backend: $e');
    }

    return isInWishlist(productId.toString());
  }

  Future<void> toggleItem(String itemId, CartItem item) async {
    if (isInWishlist(itemId)) {
      await removeItem(itemId);
    } else {
      await addItem(item);
    }
  }
}
