import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/banner.dart';
import '../../config/api_config.dart';

class BannerService extends ChangeNotifier {
  static final BannerService _instance = BannerService._internal();
  factory BannerService() => _instance;
  BannerService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;

  List<Banner> _homeBanners = [];
  List<Banner> _categoryBanners = [];
  List<Banner> _allBanners = [];
  bool _isLoading = false;
  String? _error;
  DateTime? _lastFetchTime;
  String? _lastFetchType;
  static const String _homeBannersKey = 'cached_home_banners';
  static const String _categoryBannersKey = 'cached_category_banners';
  static const Duration _cacheExpiry = Duration(minutes: 5);

  // Return banners based on last fetch type
  List<Banner> get banners => _allBanners;
  List<Banner> get homeBanners => List.unmodifiable(_homeBanners);
  List<Banner> get categoryBanners => List.unmodifiable(_categoryBanners);
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasBanners => _allBanners.isNotEmpty;

  // Load cached banners
  Future<void> loadCachedBanners() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Load home banners
      final homeBannersJson = prefs.getString(_homeBannersKey);
      if (homeBannersJson != null) {
        final List<dynamic> decoded = json.decode(homeBannersJson);
        _homeBanners = decoded.map((json) => Banner.fromJson(json)).toList();
        debugPrint('Loaded ${_homeBanners.length} cached home banners');
      }

      // Load category banners
      final categoryBannersJson = prefs.getString(_categoryBannersKey);
      if (categoryBannersJson != null) {
        final List<dynamic> decoded = json.decode(categoryBannersJson);
        _categoryBanners = decoded
            .map((json) => Banner.fromJson(json))
            .toList();
        debugPrint('Loaded ${_categoryBanners.length} cached category banners');
      }

      _allBanners = [..._homeBanners, ..._categoryBanners];
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading cached banners: $e');
    }
  }

  // Save banners to cache
  Future<void> _saveBannersToCache(String type, List<Banner> banners) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final bannersJson = json.encode(banners.map((b) => b.toJson()).toList());

      if (type == 'home') {
        await prefs.setString(_homeBannersKey, bannersJson);
      } else if (type == 'category') {
        await prefs.setString(_categoryBannersKey, bannersJson);
      }
    } catch (e) {
      debugPrint('Error saving banners to cache: $e');
    }
  }

  // Check if cache is still valid
  bool _isCacheValid(String? type) {
    if (_lastFetchTime == null || _lastFetchType != type) return false;
    return DateTime.now().difference(_lastFetchTime!) < _cacheExpiry;
  }

  // Fetch banners from backend API
  // type: 'home' for home screen banners, 'category' for category banners, null for all
  Future<void> fetchBanners({bool forceRefresh = false, String? type}) async {
    if (!forceRefresh && _isCacheValid(type)) {
      if (type == 'home' && _homeBanners.isNotEmpty) {
        debugPrint('Using cached home banners');
        return;
      } else if (type == 'category' && _categoryBanners.isNotEmpty) {
        debugPrint('Using cached category banners');
        return;
      } else if (type == null && _allBanners.isNotEmpty) {
        debugPrint('Using cached banners');
        return;
      }
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = type != null
          ? '$_apiBaseUrl/banners?type=$type'
          : '$_apiBaseUrl/banners';
      debugPrint('Fetching banners from: $url');

      final response = await http
          .get(Uri.parse(url), headers: {'Content-Type': 'application/json'})
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              throw Exception('Connection timeout. Is your backend running?');
            },
          );

      debugPrint('Banners API response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final List<dynamic> bannersData = jsonDecode(response.body);
        debugPrint(
          'Fetched ${bannersData.length} banners from backend (type: $type)',
        );

        final fetchedBanners = bannersData
            .map((json) => Banner.fromJson(json))
            .toList();

        // Store in appropriate list based on type
        if (type == 'home') {
          _homeBanners = fetchedBanners;
          await _saveBannersToCache('home', _homeBanners);
        } else if (type == 'category') {
          _categoryBanners = fetchedBanners;
          await _saveBannersToCache('category', _categoryBanners);
        } else {
          _allBanners = fetchedBanners;
        }

        _lastFetchTime = DateTime.now();
        _lastFetchType = type;
        _error = null;

        debugPrint(
          'Banners loaded successfully: ${fetchedBanners.length} (type: $type)',
        );
        notifyListeners();
      } else {
        final errorData = jsonDecode(response.body);
        _error = errorData['error'] ?? 'Failed to fetch banners';
        debugPrint('Error fetching banners: $_error');
        notifyListeners();
      }
    } on SocketException catch (e) {
      debugPrint('Network error fetching banners: $e');
      _error =
          'Cannot connect to backend. Check:\n1. Backend is running on port 4000\n2. API URL is correct\n3. Firewall allows connections';
      if (type == 'home' && _homeBanners.isEmpty) {
        await loadCachedBanners();
      } else if (type == 'category' && _categoryBanners.isEmpty) {
        await loadCachedBanners();
      }
      notifyListeners();
    } on FormatException catch (e) {
      debugPrint('Format error fetching banners: $e');
      _error = 'Invalid response from server: $e';
      notifyListeners();
    } catch (e) {
      debugPrint('Unknown error fetching banners: $e');
      _error = 'An unexpected error occurred: $e';
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshBanners() async {
    await fetchBanners(forceRefresh: true);
  }
}
