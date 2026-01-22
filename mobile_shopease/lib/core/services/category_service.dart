import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart' hide Category;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/category.dart';
import '../../config/api_config.dart';

class CategoryService extends ChangeNotifier {
  static final CategoryService _instance = CategoryService._internal();
  factory CategoryService() => _instance;
  CategoryService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;

  List<Category> _categories = [];
  bool _isLoading = false;
  String? _error;
  DateTime? _lastFetchTime;
  static const String _categoriesKey = 'cached_categories';
  static const Duration _cacheExpiry = Duration(minutes: 10);

  List<Category> get categories => List.unmodifiable(_categories);
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasCategories => _categories.isNotEmpty;

  // Get category by name
  Category? getCategoryByName(String? name) {
    if (name == null || name.isEmpty) return null;
    try {
      return _categories.firstWhere((c) => c.name == name);
    } catch (e) {
      return null;
    }
  }

  // Get parent categories (categories without parent)
  List<Category> get parentCategories {
    return _categories.where((c) => c.parentCategoryId == null).toList();
  }

  // Get subcategories of a parent category
  List<Category> getSubcategories(int parentId) {
    return _categories.where((c) => 
      c.parentCategoryId != null && c.parentCategoryId == parentId
    ).toList();
  }

  // Get subcategories by parent category name
  List<Category> getSubcategoriesByName(String? parentName) {
    if (parentName == null || parentName.isEmpty) return [];
    final parent = getCategoryByName(parentName);
    if (parent == null) return [];
    return getSubcategories(parent.id);
  }

  // Load cached categories
  Future<void> loadCachedCategories() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final categoriesJson = prefs.getString(_categoriesKey);
      if (categoriesJson != null) {
        final List<dynamic> decoded = json.decode(categoriesJson);
        _categories = decoded.map((json) => Category.fromJson(json)).toList();
        notifyListeners();
        debugPrint('Loaded ${_categories.length} cached categories');
      }
    } catch (e) {
      debugPrint('Error loading cached categories: $e');
    }
  }

  // Save categories to cache
  Future<void> _saveCategoriesToCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final categoriesJson = json.encode(_categories.map((c) => c.toJson()).toList());
      await prefs.setString(_categoriesKey, categoriesJson);
    } catch (e) {
      debugPrint('Error saving categories to cache: $e');
    }
  }

  // Check if cache is still valid
  bool get _isCacheValid {
    if (_lastFetchTime == null) return false;
    return DateTime.now().difference(_lastFetchTime!) < _cacheExpiry;
  }

  // Fetch categories from backend API
  Future<void> fetchCategories({bool forceRefresh = false}) async {
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && _isCacheValid && _categories.isNotEmpty) {
      debugPrint('Using cached categories');
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      debugPrint('Fetching categories from: $_apiBaseUrl/categories');

      final response = await http.get(
        Uri.parse('$_apiBaseUrl/categories'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Connection timeout. Is your backend running?');
        },
      );

      debugPrint('Categories API response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final List<dynamic> categoriesData = jsonDecode(response.body);
        debugPrint('Fetched ${categoriesData.length} categories from backend');

        _categories = categoriesData.map((json) => Category.fromJson(json)).toList();
        _lastFetchTime = DateTime.now();
        _error = null;

        // Save to cache
        await _saveCategoriesToCache();

        debugPrint('Categories loaded successfully: ${_categories.length}');
        notifyListeners();
      } else {
        final errorData = jsonDecode(response.body);
        _error = errorData['error'] ?? 'Failed to fetch categories';
        debugPrint('Error fetching categories: $_error');
        notifyListeners();
      }
    } on SocketException catch (e) {
      debugPrint('Network error fetching categories: $e');
      _error = 'Cannot connect to backend. Check:\n1. Backend is running on port 4000\n2. API URL is correct\n3. Firewall allows connections';
      
      // Try to load from cache if network fails
      if (_categories.isEmpty) {
        await loadCachedCategories();
      }
      
      notifyListeners();
    } on FormatException catch (e) {
      debugPrint('Format error fetching categories: $e');
      _error = 'Invalid response from server: $e';
      notifyListeners();
    } catch (e) {
      debugPrint('Unexpected error fetching categories: $e');
      _error = 'Unexpected error: $e';
      
      // Try to load from cache if network fails
      if (_categories.isEmpty) {
        await loadCachedCategories();
      }
      
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

