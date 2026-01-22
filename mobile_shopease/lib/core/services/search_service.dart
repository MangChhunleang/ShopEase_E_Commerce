import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/product.dart';
import '../../config/api_config.dart';

class SearchService extends ChangeNotifier {
  static final SearchService _instance = SearchService._internal();
  factory SearchService() => _instance;
  SearchService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;

  List<String> _searchHistory = [];
  static const String _searchHistoryKey = 'search_history';
  static const int _maxHistoryItems = 10;

  List<String> get searchHistory => List.unmodifiable(_searchHistory);

  // Load search history from storage
  Future<void> loadSearchHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final historyJson = prefs.getString(_searchHistoryKey);
      if (historyJson != null) {
        final List<dynamic> decoded = json.decode(historyJson);
        _searchHistory = decoded.map((e) => e.toString()).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading search history: $e');
    }
  }

  // Save search query to history
  Future<void> addToHistory(String query) async {
    if (query.trim().isEmpty) return;

    final trimmedQuery = query.trim();
    
    // Remove if already exists (to move to top)
    _searchHistory.remove(trimmedQuery);
    
    // Add to beginning
    _searchHistory.insert(0, trimmedQuery);
    
    // Limit history size
    if (_searchHistory.length > _maxHistoryItems) {
      _searchHistory = _searchHistory.take(_maxHistoryItems).toList();
    }

    // Save to storage
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_searchHistoryKey, json.encode(_searchHistory));
      notifyListeners();
    } catch (e) {
      debugPrint('Error saving search history: $e');
    }
  }

  // Clear search history
  Future<void> clearHistory() async {
    _searchHistory.clear();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_searchHistoryKey);
      notifyListeners();
    } catch (e) {
      debugPrint('Error clearing search history: $e');
    }
  }

  // Remove a single item from history
  Future<void> removeFromHistory(String query) async {
    _searchHistory.remove(query);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_searchHistoryKey, json.encode(_searchHistory));
      notifyListeners();
    } catch (e) {
      debugPrint('Error removing from search history: $e');
    }
  }

  // Get search suggestions from backend
  Future<List<SearchSuggestion>> getSuggestions(String query) async {
    if (query.trim().length < 2) {
      return [];
    }

    try {
      final uri = Uri.parse('$_apiBaseUrl/products/suggestions').replace(
        queryParameters: {'q': query.trim()},
      );

      final response = await http.get(uri).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw Exception('Request timeout');
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => SearchSuggestion.fromJson(json)).toList();
      } else {
        debugPrint('Failed to get suggestions: ${response.statusCode}');
        return [];
      }
    } on SocketException {
      debugPrint('Network error getting suggestions');
      return [];
    } catch (e) {
      debugPrint('Error getting suggestions: $e');
      return [];
    }
  }

  // Search products with filters
  Future<List<Product>> searchProducts({
    required String query,
    String? category,
    double? minPrice,
    double? maxPrice,
    String sort = 'name',
    int limit = 100,
    int offset = 0,
  }) async {
    try {
      final queryParams = <String, String>{
        'q': query.trim(),
        'sort': sort,
        'limit': limit.toString(),
        'offset': offset.toString(),
      };

      if (category != null && category.isNotEmpty && category.toLowerCase() != 'all') {
        queryParams['category'] = category;
      }
      if (minPrice != null) {
        queryParams['minPrice'] = minPrice.toString();
      }
      if (maxPrice != null) {
        queryParams['maxPrice'] = maxPrice.toString();
      }

      final uri = Uri.parse('$_apiBaseUrl/products/search').replace(
        queryParameters: queryParams,
      );

      final response = await http.get(uri).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Request timeout');
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => Product.fromJson(json)).toList();
      } else {
        debugPrint('Search failed: ${response.statusCode}');
        return [];
      }
    } on SocketException {
      debugPrint('Network error during search');
      return [];
    } catch (e) {
      debugPrint('Error searching products: $e');
      return [];
    }
  }
}

// Search suggestion model
class SearchSuggestion {
  final String text;
  final String? category;
  final String type; // 'product' or 'category'

  SearchSuggestion({
    required this.text,
    this.category,
    required this.type,
  });

  factory SearchSuggestion.fromJson(Map<String, dynamic> json) {
    return SearchSuggestion(
      text: json['text'] as String,
      category: json['category'] as String?,
      type: json['type'] as String? ?? 'product',
    );
  }
}

