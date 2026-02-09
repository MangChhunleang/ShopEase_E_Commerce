import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/product.dart';
import '../../config/api_config.dart';

class ProductService extends ChangeNotifier {
  static final ProductService _instance = ProductService._internal();
  factory ProductService() => _instance;
  ProductService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;

  List<Product> _products = [];
  bool _isLoading = false;
  String? _error;
  DateTime? _lastFetchTime;
  static const String _productsKey = 'cached_products';
  static const Duration _cacheExpiry = Duration(minutes: 5);

  List<Product> get products => List.unmodifiable(_products);
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasProducts => _products.isNotEmpty;

  // Get products by category (case-insensitive matching)
  List<Product> getProductsByCategory(String? category) {
    if (category == null || category.isEmpty || category == 'All') {
      return _products;
    }
    // Case-insensitive and trim whitespace for comparison
    final normalizedCategory = category.trim().toLowerCase();
    return _products.where((p) {
      if (p.category == null || p.category!.isEmpty) return false;
      return p.category!.trim().toLowerCase() == normalizedCategory;
    }).toList();
  }

  // Search products by name
  List<Product> searchProducts(String query) {
    if (query.isEmpty) {
      return _products;
    }
    final lowerQuery = query.toLowerCase();
    return _products.where((p) {
      return p.name.toLowerCase().contains(lowerQuery) ||
          (p.description?.toLowerCase().contains(lowerQuery) ?? false);
    }).toList();
  }

  // Get all unique categories
  List<String> getCategories() {
    final categories = _products
        .where((p) => p.category != null && p.category!.isNotEmpty)
        .map((p) => p.category!)
        .toSet()
        .toList();
    categories.sort();
    return ['All', ...categories];
  }

  // Load cached products
  Future<void> loadCachedProducts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final productsJson = prefs.getString(_productsKey);
      if (productsJson != null) {
        final List<dynamic> decoded = json.decode(productsJson);
        _products = decoded.map((json) => Product.fromJson(json)).toList();
        notifyListeners();
        debugPrint('Loaded ${_products.length} cached products');
      }
    } catch (e) {
      debugPrint('Error loading cached products: $e');
    }
  }

  // Save products to cache
  Future<void> _saveProductsToCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final productsJson = json.encode(_products.map((p) => p.toJson()).toList());
      await prefs.setString(_productsKey, productsJson);
    } catch (e) {
      debugPrint('Error saving products to cache: $e');
    }
  }

  // Check if cache is still valid
  bool get _isCacheValid {
    if (_lastFetchTime == null) return false;
    return DateTime.now().difference(_lastFetchTime!) < _cacheExpiry;
  }

  // Fetch products from backend API
  Future<void> fetchProducts({bool forceRefresh = false}) async {
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && _isCacheValid && _products.isNotEmpty) {
      debugPrint('Using cached products');
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      debugPrint('Fetching products from: $_apiBaseUrl/products');

      final response = await http.get(
        Uri.parse('$_apiBaseUrl/products'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Connection timeout. Is your backend running?');
        },
      );

      debugPrint('Products API response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        // Backend returns { data: [...], pagination: {...} }
        // but keep compatibility if it ever returns a raw list.
        final List<dynamic> productsData;
        if (decoded is List) {
          productsData = decoded;
        } else if (decoded is Map<String, dynamic> && decoded['data'] is List) {
          productsData = decoded['data'] as List<dynamic>;
        } else {
          throw const FormatException('Unexpected products response format');
        }
        debugPrint('Fetched ${productsData.length} products from backend');
        
        _products = productsData.map((json) => Product.fromJson(json)).toList();
        _lastFetchTime = DateTime.now();
        _error = null;

        // Save to cache
        await _saveProductsToCache();

        debugPrint('Products loaded successfully: ${_products.length}');
        notifyListeners();
      } else {
        final errorData = jsonDecode(response.body);
        _error = errorData['error'] ?? 'Failed to fetch products';
        debugPrint('Error fetching products: $_error');
        notifyListeners();
      }
    } on SocketException catch (e) {
      debugPrint('Network error fetching products: $e');
      _error = 'Cannot connect to backend. Check:\n1. Backend is running on port 4000\n2. API URL is correct\n3. Firewall allows connections';
      
      // Try to load from cache if network fails
      if (_products.isEmpty) {
        await loadCachedProducts();
      }
      
      notifyListeners();
    } on FormatException catch (e) {
      debugPrint('Format error fetching products: $e');
      _error = 'Invalid response from server: $e';
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching products: $e');
      _error = 'Failed to fetch products: ${e.toString()}';
      
      // Try to load from cache if fetch fails
      if (_products.isEmpty) {
        await loadCachedProducts();
      }
      
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Get product by ID
  Product? getProductById(int id) {
    try {
      return _products.firstWhere((p) => p.id == id);
    } catch (e) {
      return null;
    }
  }

  // Refresh products (force fetch from API)
  Future<void> refreshProducts() async {
    await fetchProducts(forceRefresh: true);
  }
}

