import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'dart:io';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../config/api_config.dart';

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;

  // Initialize Firebase Auth settings
  AuthService._internal() {
    // On emulators we disable app verification to avoid Chrome reCAPTCHA; keep enabled in release.
    final bool isAndroidEmuDev =
        !kReleaseMode && defaultTargetPlatform == TargetPlatform.android;
    _firebaseAuth.setSettings(
      appVerificationDisabledForTesting: isAndroidEmuDev,
    );
  }

  String? _currentUserId;
  String? _currentPhoneNumber;
  String? _token;
  String? _role;
  String? _email;
  String? _profileImageUrl;

  static const String _authKey = 'user_auth';
  static const String _phoneKey = 'user_phone';
  static const String _tokenKey = 'auth_token';
  static const String _roleKey = 'auth_role';
  static const String _emailKey = 'auth_email';
  static const String _profileImageKey = 'user_profile_image';

  // Temporary storage for verification ID during the flow
  String? _verificationId;
  int? _resendToken;

  bool get isAuthenticated => _token != null || _currentUserId != null;
  String? get currentUserId => _currentUserId;
  String? get currentPhoneNumber => _currentPhoneNumber;
  String? get token => _token;
  String? get role => _role;
  bool get isAdmin => _role?.toUpperCase() == 'ADMIN';
  String? get email => _email;
  String? get profileImageUrl => _profileImageUrl;

  Future<void> loadAuth() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _currentUserId = prefs.getString(_authKey);
      _currentPhoneNumber = prefs.getString(_phoneKey);
      _token = prefs.getString(_tokenKey);
      _role = prefs.getString(_roleKey);
      _email = prefs.getString(_emailKey);
      _profileImageUrl = prefs.getString(_profileImageKey);
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading auth: $e');
    }
  }

  Future<void> _clearAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_authKey);
    await prefs.remove(_phoneKey);
    await prefs.remove(_tokenKey);
    await prefs.remove(_roleKey);
    await prefs.remove(_emailKey);
    await prefs.remove(_profileImageKey);

    await prefs.remove('orders');
    await prefs.remove('customer_info');

    _currentUserId = null;
    _currentPhoneNumber = null;
    _token = null;
    _role = null;
    _email = null;
    _profileImageUrl = null;
    _verificationId = null;

    await _firebaseAuth.signOut();
    notifyListeners();
  }

  Future<void> logout() async {
    _profileImageUrl = null;
    await _clearAuthData();
  }

  // Helper to exchange Firebase ID Token for Backend JWT
  Future<void> _backendLogin(String idToken) async {
    debugPrint('Exchanging Firebase Token for Backend JWT...');
    debugPrint('API URL: $_apiBaseUrl/auth/firebase-login');
    debugPrint('ID Token length: ${idToken.length}');
    debugPrint(
      'ID Token preview: ${idToken.substring(0, idToken.length > 50 ? 50 : idToken.length)}...',
    );

    final response = await http
        .post(
          Uri.parse('$_apiBaseUrl/auth/firebase-login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'idToken': idToken}),
        )
        .timeout(const Duration(seconds: 15));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      // Backend returns: { token, role, userId }
      final token = data['token'];
      final role = data['role'];
      final userId = data['userId']?.toString();
      final phone = data['phoneNumber'];

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      await prefs.setString(_roleKey, role);
      if (userId != null) {
        await prefs.setString(_authKey, userId);
      }
      await prefs.setString(_phoneKey, phone);

      _token = token;
      _role = role;
      _currentUserId = userId;
      _currentPhoneNumber = phone;

      notifyListeners();
    } else {
      throw Exception('Backend error: ${response.statusCode}');
    }
  }

  // Restore missing method
  Future<void> clearProfileImage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_profileImageKey);
      _profileImageUrl = null;
      notifyListeners();
    } catch (e) {
      debugPrint('Error clearing profile image: $e');
    }
  }

  Future<String> requestVerificationCode(
    String countryCode,
    String phoneNumber,
  ) async {
    // clean phone number
    final cleanPhone = phoneNumber.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    final cleanCountry = countryCode.startsWith('+')
        ? countryCode
        : '+$countryCode';
    final fullPhone = '$cleanCountry$cleanPhone';
    debugPrint('=========== FIREBASE PHONE AUTH ===========');
    debugPrint('Attempting to verify phone number: $fullPhone');
    debugPrint('Firebase Auth instance: ${_firebaseAuth.app.name}');

    final completer = Completer<String>();

    try {
      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber: fullPhone,
        // Force the multi-factor-user-id if available
        multiFactorSession: null,
        // Set a reasonable timeout
        timeout: const Duration(seconds: 120),
        // Important: Use forceResendingToken if available for retry
        forceResendingToken: _resendToken,
        verificationCompleted: (PhoneAuthCredential credential) async {
          debugPrint('[Firebase] Auto-verification completed!');
          // Auto-sign in if possible
          try {
            final userCredential = await _firebaseAuth.signInWithCredential(
              credential,
            );
            if (userCredential.user != null) {
              final idToken = await userCredential.user!.getIdToken();
              if (idToken != null) {
                await _backendLogin(idToken);
                if (!completer.isCompleted) {
                  completer.complete('auto-verified');
                }
              }
            }
          } catch (e) {
            debugPrint('[Firebase] Auto-verification error: $e');
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          debugPrint('[Firebase] Verification FAILED!');
          debugPrint('[Firebase] Error code: ${e.code}');
          debugPrint('[Firebase] Error message: ${e.message}');
          if (!completer.isCompleted) {
            completer.completeError(e.message ?? 'Verification failed');
          }
        },
        codeSent: (String verificationId, int? resendToken) {
          debugPrint('[Firebase] Code SENT successfully!');
          debugPrint('[Firebase] Verification ID: $verificationId');
          _verificationId = verificationId;
          _resendToken = resendToken;
          if (!completer.isCompleted) {
            completer.complete(verificationId);
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          debugPrint('[Firebase] Code auto-retrieval timeout');
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      debugPrint('[Firebase] Exception during verifyPhoneNumber: $e');
      throw Exception('Failed to start phone auth: $e');
    }

    return completer.future;
  }

  /// Dev-only: Login with static phone (bypass Firebase) - for local testing
  Future<bool> devLoginWithPhone({required String countryCode, required String phoneNumber}) async {
    try {
      final cleanPhone = phoneNumber.replaceAll(RegExp(r'[\s\-\(\)]'), '');
      final cleanCountry = countryCode.startsWith('+') ? countryCode : '+$countryCode';
      final fullPhone = '$cleanCountry$cleanPhone';

      debugPrint('[Dev-Login] Calling dev-login with phone: $fullPhone');
      final response = await http
          .post(
            Uri.parse('$_apiBaseUrl/auth/dev-login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'phone': fullPhone}),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'] as String;
        final role = data['role'] as String;
        final userId = data['userId']?.toString();
        final phone = data['phoneNumber'] as String? ?? fullPhone;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        await prefs.setString(_roleKey, role);
        await prefs.setString(_phoneKey, phone);
        if (userId != null) await prefs.setString(_authKey, userId);

        _token = token;
        _role = role;
        _currentUserId = userId;
        _currentPhoneNumber = phone;
        notifyListeners();
        return true;
      } else {
        throw Exception('Dev login failed: ${response.body}');
      }
    } catch (e) {
      debugPrint('Error in devLoginWithPhone: $e');
      rethrow;
    }
  }

  Future<bool> signInWithPhone({
    required String countryCode,
    required String phoneNumber,
    required String verificationCode,
  }) async {
    try {
      if (_verificationId == null) {
        throw Exception('Verification ID is missing. Request code again.');
      }

      // Create credential
      PhoneAuthCredential credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: verificationCode,
      );

      // Sign in to Firebase
      final userCredential = await _firebaseAuth.signInWithCredential(
        credential,
      );
      final user = userCredential.user;

      if (user != null) {
        // Get ID Token
        debugPrint('Getting ID token from Firebase user...');
        final idToken = await user.getIdToken();
        debugPrint(
          'ID Token obtained: ${idToken != null ? "Yes (${idToken.length} chars)" : "No"}',
        );

        // Authenticate with backend
        if (idToken != null && idToken.isNotEmpty) {
          await _backendLogin(idToken);
        } else {
          throw Exception('Failed to get ID token from Firebase');
        }
        return true;
      } else {
        throw Exception('Firebase sign-in returned null user');
      }
    } catch (e) {
      debugPrint('Error signing in: $e');
      rethrow;
    }
  }

  // --- EXISTING EMAIL LOGIN (UNCHANGED) ---
  Future<bool> loginWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      await _clearAuthData();
      debugPrint('Attempting login to: $_apiBaseUrl/auth/login');
      final response = await http
          .post(
            Uri.parse('$_apiBaseUrl/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'] as String;
        final role = data['role'] as String;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        await prefs.setString(_roleKey, role);
        await prefs.setString(_emailKey, email);

        _token = token;
        _role = role;
        _email = email;

        // Decode token for userId logic (simplified)
        // ... (keeping existing token decoding if needed, or trusting backend response)
        // For brevity in this refactor, relying on existing or backend response would be better
        // But let's keep the existing manual decode for safety if backend doesn't return ID directly
        try {
          final parts = token.split('.');
          if (parts.length == 3) {
            String base64Str = parts[1]
                .replaceAll('-', '+')
                .replaceAll('_', '/');
            while (base64Str.length % 4 != 0) {
              base64Str += '=';
            }
            final payload = jsonDecode(utf8.decode(base64Decode(base64Str)));
            _currentUserId = payload['userId']?.toString();
            await prefs.setString(_authKey, _currentUserId ?? '');
          }
        } catch (e) {
          debugPrint('Error decoding token: $e');
        }

        notifyListeners();
        return true;
      } else {
        throw Exception('Login failed: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  // Get authorization headers for API calls
  Map<String, String> getAuthHeaders() {
    if (_token == null) {
      return {'Content-Type': 'application/json'};
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $_token',
    };
  }

  Future<void> signOut() => logout();

  // --- EXISTING UPLOAD PROFILE IMAGE (UNCHANGED) ---
  Future<String> uploadProfileImage(File imageFile) async {
    if (_token == null) throw Exception('Auth required');
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_apiBaseUrl/user/upload'),
      );
      request.headers['Authorization'] = 'Bearer $_token';
      final fileStream = http.ByteStream(imageFile.openRead());
      final fileLength = await imageFile.length();
      final fileName = imageFile.path.split('/').last;
      request.files.add(
        http.MultipartFile(
          'image',
          fileStream,
          fileLength,
          filename: fileName,
          contentType: MediaType('image', 'jpeg'), // Simplified for brevity
        ),
      );

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final imageUrl = data['images'][0] as String;
        final processed = _processImageUrl(imageUrl);
        await _saveProfileImage(processed);
        return processed;
      } else {
        throw Exception('Upload failed');
      }
    } catch (e) {
      rethrow;
    }
  }

  String _processImageUrl(String imageUrl) {
    return ApiConfig.processImageUrl(imageUrl);
  }

  Future<void> _saveProfileImage(String imageUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_profileImageKey, imageUrl);
    _profileImageUrl = imageUrl;
    notifyListeners();
  }
}
