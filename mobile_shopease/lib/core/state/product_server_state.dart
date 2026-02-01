import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/product.dart';
import '../../config/api_config.dart';
import '../state/server_state.dart';

/// Server state for managing product catalog data
/// 
/// This service handles:
/// - Fetching products from the API
/// - Caching products locally for offline access
/// - Filtering and searching products
/// - Managing product-related data lifecycle
class ProductServerState extends ServerState {
  static final ProductServerState _instance = ProductServerState._internal();
  factory ProductServerState() => _instance;
  ProductServerState._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;
  static const String _cacheKey = 'cached_products';
  static const Duration _cacheExpiry = Duration(minutes: 5);

  List<Product> _products = [];

  /// Immutable list of all products
  List<Product> get products => List.unmodifiable(_products);

  /// Whether products have been loaded
  bool get hasProducts => _products.isNotEmpty;

  /// Get products filtered by category
  List<Product> getProductsByCategory(String? category) {
    if (category == null || category.isEmpty || category == 'All') {
      return _products;
    }
    final normalizedCategory = category.trim().toLowerCase();
    return _products.where((p) {
      if (p.category == null || p.category!.isEmpty) return false;
      return p.category!.trim().toLowerCase() == normalizedCategory;
    }).toList();
  }

  /// Search products by name or description
  List<Product> searchProducts(String query) {
    if (query.isEmpty) return _products;
    final lowerQuery = query.toLowerCase();
    return _products.where((p) {
      return p.name.toLowerCase().contains(lowerQuery) ||
          (p.description?.toLowerCase().contains(lowerQuery) ?? false);
    }).toList();
  }

  /// Get all unique categories from products
  List<String> getCategories() {
    final categories = _products
        .where((p) => p.category != null && p.category!.isNotEmpty)
        .map((p) => p.category!)
        .toSet()
        .toList();
    categories.sort();
    return ['All', ...categories];
  }

  @override
  Future<void> loadCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final productsJson = prefs.getString(_cacheKey);
      if (productsJson != null) {
        final List<dynamic> decoded = json.decode(productsJson);
        _products = decoded.map((json) => Product.fromJson(json)).toList();
        markFetchSuccess();
        notifyListeners();
        debugPrint('✓ Loaded ${_products.length} cached products');
      }
    } catch (e) {
      debugPrint('✗ Error loading cached products: $e');
    }
  }

  @override
  Future<void> fetch({bool forceRefresh = false}) async {
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && isCacheValid(_cacheExpiry) && _products.isNotEmpty) {
      debugPrint('✓ Using cached products (${_products.length} items)');
      return;
    }

    setLoading(true);
    notifyListeners();

    try {
      final response = await http
          .get(Uri.parse('$_apiBaseUrl/products'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        _products = data.map((json) => Product.fromJson(json)).toList();
        
        markFetchSuccess();
        await _saveToCache();
        notifyListeners();
        
        debugPrint('✓ Fetched ${_products.length} products from API');
      } else {
        throw Exception('Failed to load products: ${response.statusCode}');
      }
    } catch (e) {
      setError('Failed to load products: $e');
      debugPrint('✗ Error fetching products: $e');
      rethrow;
    }
  }

  @override
  Future<void> clearCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_cacheKey);
      _products = [];
      notifyListeners();
      debugPrint('✓ Cleared products cache');
    } catch (e) {
      debugPrint('✗ Error clearing products cache: $e');
    }
  }

  Future<void> _saveToCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final productsJson = json.encode(_products.map((p) => p.toJson()).toList());
      await prefs.setString(_cacheKey, productsJson);
    } catch (e) {
      debugPrint('✗ Error saving products to cache: $e');
    }
  }
}
