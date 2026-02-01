import 'package:flutter/foundation.dart';

/// Base class for all server state services
/// 
/// Server state represents data fetched from the API that needs to be:
/// - Cached for offline access
/// - Shared across multiple screens
/// - Persisted across app sessions
/// 
/// Examples: Products, Orders, User Profile, Categories, Banners
abstract class ServerState extends ChangeNotifier {
  bool _isLoading = false;
  String? _error;
  DateTime? _lastFetchTime;

  /// Whether data is currently being fetched from the API
  bool get isLoading => _isLoading;

  /// Error message from the last failed operation
  String? get error => _error;

  /// Timestamp of the last successful fetch
  DateTime? get lastFetchTime => _lastFetchTime;

  /// Set loading state and notify listeners
  @protected
  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// Set error state and notify listeners
  @protected
  void setError(String? error) {
    _error = error;
    _isLoading = false;
    notifyListeners();
  }

  /// Update last fetch time and clear error
  @protected
  void markFetchSuccess() {
    _lastFetchTime = DateTime.now();
    _error = null;
    _isLoading = false;
  }

  /// Check if cached data is still valid
  @protected
  bool isCacheValid(Duration expiry) {
    if (_lastFetchTime == null) return false;
    return DateTime.now().difference(_lastFetchTime!) < expiry;
  }

  /// Load cached data from persistent storage
  Future<void> loadCache();

  /// Fetch fresh data from the API
  Future<void> fetch({bool forceRefresh = false});

  /// Clear all cached data
  Future<void> clearCache();
}

/// Extension methods for common server state patterns
extension ServerStateExtensions on ServerState {
  /// Whether data has been loaded (either from cache or API)
  bool get hasData => lastFetchTime != null && !isLoading;

  /// Whether data is being fetched for the first time
  bool get isInitialLoading => isLoading && lastFetchTime == null;

  /// Whether there's an error and no cached data
  bool get hasErrorNoData => error != null && lastFetchTime == null;
}
