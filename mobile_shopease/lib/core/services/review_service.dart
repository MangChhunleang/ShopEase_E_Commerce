import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/review.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';

class ReviewService extends ChangeNotifier {
  static final ReviewService _instance = ReviewService._internal();
  factory ReviewService() => _instance;
  ReviewService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;
  bool _isLoading = false;
  String? _error;

  bool get isLoading => _isLoading;
  String? get error => _error;

  // Get reviews for a product
  Future<Map<String, dynamic>> getProductReviews(int productId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await http.get(
        Uri.parse('$_apiBaseUrl/products/$productId/reviews'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Connection timeout');
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final reviews = (data['reviews'] as List)
            .map((json) => Review.fromJson(json))
            .toList();
        
        _error = null;
        return {
          'reviews': reviews,
          'averageRating': data['averageRating'] ?? '0.0',
          'totalReviews': data['totalReviews'] ?? 0,
        };
      } else {
        _error = 'Failed to load reviews';
        return {
          'reviews': <Review>[],
          'averageRating': '0.0',
          'totalReviews': 0,
        };
      }
    } on SocketException catch (e) {
      _error = 'Network error: $e';
      return {
        'reviews': <Review>[],
        'averageRating': '0.0',
        'totalReviews': 0,
      };
    } catch (e) {
      _error = 'Error loading reviews: $e';
      return {
        'reviews': <Review>[],
        'averageRating': '0.0',
        'totalReviews': 0,
      };
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Submit a review
  Future<bool> submitReview({
    required int productId,
    required int rating,
    String? comment,
    String? userName,
  }) async {
    final authService = AuthService();
    if (!authService.isAuthenticated || authService.token == null) {
      _error = 'Please login to submit a review';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/products/$productId/reviews'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${authService.token}',
        },
        body: jsonEncode({
          'rating': rating,
          'comment': comment,
          'userName': userName,
        }),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Connection timeout');
        },
      );

      if (response.statusCode == 201) {
        _error = null;
        notifyListeners();
        return true;
      } else {
        final errorData = jsonDecode(response.body);
        _error = errorData['error'] ?? 'Failed to submit review';
        notifyListeners();
        return false;
      }
    } on SocketException catch (e) {
      _error = 'Network error: $e';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Error submitting review: $e';
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

