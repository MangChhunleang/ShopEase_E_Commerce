import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../models/order.dart';
import '../models/cart_item.dart';
import '../../config/api_config.dart';
import 'auth_service.dart';
import 'notification_service.dart';

class OrderService extends ChangeNotifier {
  static final OrderService _instance = OrderService._internal();
  factory OrderService() => _instance;
  OrderService._internal();

  static String get _apiBaseUrl => ApiConfig.apiBaseUrl;

  List<Order> _orders = [];
  static const String _ordersKey = 'orders';
  static const String _customerInfoKey = 'customer_info';

  List<Order> get orders => List.unmodifiable(_orders.reversed); // Newest first

  int get orderCount => _orders.length;

  Future<void> loadOrders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ordersJson = prefs.getString(_ordersKey);
      if (ordersJson != null) {
        final List<dynamic> decoded = json.decode(ordersJson);
        _orders = decoded.map((order) => Order.fromJson(order)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading orders: $e');
    }
  }

  // Fetch orders from backend API and sync with local storage
  Future<void> syncOrdersFromBackend() async {
    try {
      final authService = AuthService();
      final userId = authService.currentUserId;
      final token = authService.token;

      debugPrint(
        'Syncing orders from backend. userId: $userId, hasToken: ${token != null}',
      );

      // Check if user has changed
      final prefs = await SharedPreferences.getInstance();
      final lastUserId = prefs.getString('last_user_id');

      if (lastUserId != userId) {
        // User changed, clear local orders
        _orders = [];
        await prefs.remove(_ordersKey);
        if (userId != null) {
          await prefs.setString('last_user_id', userId);
        } else {
          await prefs.remove('last_user_id');
        }
      }

      // Build headers with auth token if available
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      // Build URL - backend will automatically filter by userId if user is logged in
      // For guest users (no userId), we'll try to fetch orders anyway
      // Note: Backend requires auth, so guest users won't be able to sync
      String url = '$_apiBaseUrl/orders';

      // Only add userId param if user is logged in AND has token (for admin filtering)
      if (userId != null && token != null) {
        // Backend handles userId filtering automatically, but we can still pass it
        // for admin users who want to filter by specific userId
      }

      debugPrint('Fetching orders from: $url');

      // Fetch orders from backend
      final response = await http
          .get(Uri.parse(url), headers: headers)
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              throw Exception('Connection timeout');
            },
          );

      debugPrint('Sync response status: ${response.statusCode}');
      debugPrint(
        'Sync response body: ${response.body.substring(0, response.body.length > 200 ? 200 : response.body.length)}',
      );

      if (response.statusCode == 200) {
        final List<dynamic> ordersData = jsonDecode(response.body);
        debugPrint('Fetched ${ordersData.length} orders from backend');

        // Debug: print first order structure if available
        if (ordersData.isNotEmpty) {
          debugPrint('First order structure: ${jsonEncode(ordersData[0])}');
        }

        // Map backend orders to local Order format
        final List<Order> backendOrders = ordersData.map((orderData) {
          // Map status string to enum
          OrderStatus status;
          final statusStr = orderData['status'] as String? ?? 'pending';
          switch (statusStr) {
            case 'pending':
              status = OrderStatus.pending;
              break;
            case 'processing':
              status = OrderStatus.processing;
              break;
            case 'delivered':
              status = OrderStatus.delivered;
              break;
            case 'expired':
              status = OrderStatus.expired;
              break;
            case 'failed':
              status = OrderStatus.failed;
              break;
            case 'cancelled':
              status = OrderStatus.cancelled;
              break;
            default:
              status = OrderStatus.pending;
          }

          // Map items
          final List<CartItem>
          mappedItems = (orderData['items'] as List? ?? []).map((item) {
            debugPrint('Mapping item: $item');
            return CartItem(
              id: item['productId']?.toString() ?? item['id']?.toString() ?? '',
              name: item['productName'] ?? item['name'] ?? 'Unknown Product',
              imageUrl: item['productImage'] ?? item['imageUrl'] ?? '',
              price: (item['price'] as num?)?.toString() ?? '0',
              quantity: item['quantity'] ?? 1,
              color: item['color'],
              offer: item['offer'],
            );
          }).toList();

          debugPrint(
            'Mapped ${mappedItems.length} items for order ${orderData['orderNumber']}',
          );

          // Helper to parse numeric values
          double parseNumeric(dynamic value, double fallback) {
            if (value == null) return fallback;
            if (value is num) return value.toDouble();
            if (value is String) {
              final parsed = double.tryParse(value);
              return parsed ?? fallback;
            }
            return fallback;
          }

          return Order(
            id: orderData['id']?.toString() ?? '',
            orderNumber: orderData['orderNumber'] ?? '',
            items: mappedItems,
            subtotal: parseNumeric(orderData['subtotal'], 0),
            shipping: parseNumeric(orderData['shipping'], 0),
            total: parseNumeric(orderData['total'], 0),
            customerName: orderData['customerName'] ?? '',
            customerPhone: orderData['customerPhone'] ?? '',
            customerAddress: orderData['customerAddress'] ?? '',
            customerCity: orderData['customerCity'] ?? '',
            customerDistrict: orderData['customerDistrict'] ?? '',
            paymentMethod: orderData['paymentMethod'] ?? '',
            status: status,
            orderDate: _parseOrderDate(orderData['orderDate']),
          );
        }).toList();

        // Update local orders with backend data
        // Since backend returns ALL orders for the user, we can replace our local list
        // This ensures orders deleted on backend (e.g. via terminal script) are removed locally

        final notificationService = NotificationService();

        // Check for new orders or status changes to notify
        for (final backendOrder in backendOrders) {
          // Try to find matching existing order
          int index = _orders.indexWhere(
            (order) => order.id == backendOrder.id,
          );
          if (index < 0) {
            index = _orders.indexWhere(
              (order) => order.orderNumber == backendOrder.orderNumber,
            );
          }

          if (index >= 0) {
            // Check if status changed
            final oldStatus = _orders[index].status;
            final newStatus = backendOrder.status;

            if (oldStatus != newStatus) {
              debugPrint(
                'Order status changed: ${backendOrder.orderNumber} - ${oldStatus.toString()} -> ${newStatus.toString()}',
              );

              // Trigger notification
              try {
                final orderId = int.tryParse(backendOrder.id);
                await notificationService.notifyOrderUpdate(
                  orderNumber: backendOrder.orderNumber,
                  status: backendOrder.statusText,
                  orderId: orderId,
                );
              } catch (e) {
                debugPrint('Error creating notification: $e');
              }
            }
          }
        }

        // FULL SYNC: Replace existing orders with backend orders
        // This correctly handles:
        // 1. New orders added (will be in list)
        // 2. Updated orders (will have new status)
        // 3. DELETED orders (will NOT be in list, so they get removed)
        _orders = backendOrders;

        // Save to local storage
        await _saveOrders();
        notifyListeners();
        debugPrint(
          'Orders synced successfully. Total orders: ${_orders.length}',
        );
      } else if (response.statusCode == 401) {
        debugPrint('Unauthorized - token may be expired. Logging out user.');
        // Token is invalid/expired - log out the user to trigger re-authentication
        await AuthService().logout();
        return; // Exit early after logout
      } else if (response.statusCode == 403) {
        debugPrint(
          'Forbidden - user does not have permission to fetch orders.',
        );
        // Don't throw - just log and return
        return;
      } else {
        debugPrint(
          'Failed to fetch orders: ${response.statusCode} - ${response.body}',
        );
        // Don't throw - just log the error
        return;
      }
    } catch (e) {
      debugPrint('Error syncing orders from backend: $e');
      debugPrint('Error type: ${e.runtimeType}');
      rethrow; // Rethrow to let the UI know
    }
  }

  // Delete all orders for the current user
  // Method removed as requested by user

  Future<void> _saveOrders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ordersJson = json.encode(
        _orders.map((order) => order.toJson()).toList(),
      );
      await prefs.setString(_ordersKey, ordersJson);
    } catch (e) {
      debugPrint('Error saving orders: $e');
    }
  }

  Future<String> createOrder({
    required List<CartItem> items,
    required double subtotal,
    required double shipping,
    required double total,
    required String customerName,
    required String customerPhone,
    required String customerAddress,
    required String customerCity,
    required String customerDistrict,
    required String paymentMethod,
  }) async {
    try {
      // Map payment method to backend format
      String backendPaymentMethod = paymentMethod;
      if (paymentMethod.contains('Cash on Delivery') ||
          paymentMethod.contains('COD')) {
        backendPaymentMethod = 'Cash on Delivery';
      } else if (paymentMethod.contains('ABA')) {
        backendPaymentMethod = 'ABA Pay';
      } else if (paymentMethod.contains('Bakong')) {
        backendPaymentMethod = 'Bakong';
      }

      // Get userId from AuthService if available
      final authService = AuthService();
      final userId = authService.currentUserId;
      int? userIdInt;
      if (userId != null) {
        userIdInt = int.tryParse(userId);
      }

      // Prepare items for backend API
      final List<Map<String, dynamic>> itemsPayload = items.map((item) {
        // Extract numeric price from string (remove $ and other characters)
        final priceValue =
            double.tryParse(item.price.replaceAll(RegExp(r'[^\d.]'), '')) ??
            0.0;

        return {
          'productId':
              int.tryParse(item.id) ?? null, // Try to parse id as productId
          'name': item.name,
          'productName': item.name,
          'imageUrl': item.imageUrl,
          'productImage': item.imageUrl,
          'price': priceValue,
          'quantity': item.quantity,
          'color': item.color,
          'offer': item.offer,
        };
      }).toList();

      // Prepare request body
      final requestBody = {
        'items': itemsPayload,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'customerAddress': customerAddress,
        'customerCity': customerCity,
        'customerDistrict': customerDistrict,
        'paymentMethod': backendPaymentMethod,
        if (userIdInt != null) 'userId': userIdInt,
      };

      debugPrint('Creating order via API: $_apiBaseUrl/orders');
      debugPrint('Request body: ${jsonEncode(requestBody)}');

      // Call backend API
      final response = await http
          .post(
            Uri.parse('$_apiBaseUrl/orders'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(requestBody),
          )
          .timeout(
            const Duration(seconds: 15),
            onTimeout: () {
              throw Exception('Connection timeout. Is your backend running?');
            },
          );

      debugPrint('Order API response status: ${response.statusCode}');
      debugPrint('Order API response body: ${response.body}');

      if (response.statusCode == 201) {
        // Order created successfully
        Map<String, dynamic> orderData;
        try {
          orderData = jsonDecode(response.body) as Map<String, dynamic>;
          debugPrint('Parsed order data: $orderData');
        } catch (e) {
          debugPrint('Error parsing order response JSON: $e');
          throw Exception('Invalid JSON response from server: $e');
        }

        // Extract order ID and order number from backend response
        try {
          final backendOrderId =
              orderData['id']?.toString() ??
              DateTime.now().millisecondsSinceEpoch.toString();
          final backendOrderNumber =
              orderData['orderNumber'] as String? ??
              'ORD-${DateTime.now().year}${DateTime.now().month.toString().padLeft(2, '0')}${DateTime.now().day.toString().padLeft(2, '0')}-${backendOrderId.substring(backendOrderId.length - 6)}';

          debugPrint(
            'Extracted orderId: $backendOrderId, orderNumber: $backendOrderNumber',
          );

          // Map backend order items to CartItem format for local storage
          final List<CartItem>
          mappedItems = (orderData['items'] as List? ?? []).map((item) {
            try {
              return CartItem(
                id:
                    item['productId']?.toString() ??
                    item['id']?.toString() ??
                    '',
                name: item['productName'] ?? item['name'] ?? 'Unknown Product',
                imageUrl: item['productImage'] ?? item['imageUrl'] ?? '',
                price: (item['price'] as num?)?.toString() ?? '0',
                quantity: item['quantity'] ?? 1,
                color: item['color'],
                offer: item['offer'],
              );
            } catch (e) {
              debugPrint('Error mapping item: $item, error: $e');
              rethrow;
            }
          }).toList();

          debugPrint('Mapped ${mappedItems.length} items');

          // Helper function to parse numeric values (handles both string and num types from MySQL)
          double parseNumeric(dynamic value, double fallback) {
            if (value == null) return fallback;
            if (value is num) return value.toDouble();
            if (value is String) {
              final parsed = double.tryParse(value);
              return parsed ?? fallback;
            }
            return fallback;
          }

          // Create local order object for offline viewing
          final order = Order(
            id: backendOrderId,
            orderNumber: backendOrderNumber,
            items: mappedItems,
            subtotal: parseNumeric(orderData['subtotal'], subtotal),
            shipping: parseNumeric(orderData['shipping'], shipping),
            total: parseNumeric(orderData['total'], total),
            customerName: orderData['customerName'] ?? customerName,
            customerPhone: orderData['customerPhone'] ?? customerPhone,
            customerAddress: orderData['customerAddress'] ?? customerAddress,
            customerCity: orderData['customerCity'] ?? customerCity,
            customerDistrict: orderData['customerDistrict'] ?? customerDistrict,
            paymentMethod: orderData['paymentMethod'] ?? paymentMethod,
            status: _parseOrderStatus(orderData['status']),
            orderDate: _parseOrderDate(orderData['orderDate']),
          );

          // Save locally for offline viewing
          _orders.add(order);
          notifyListeners();
          await _saveOrders();
          await _saveCustomerInfo(
            customerName,
            customerPhone,
            customerAddress,
            customerCity,
            customerDistrict,
          );

          debugPrint(
            'Order created successfully: $backendOrderNumber (ID: $backendOrderId)',
          );
          return backendOrderId;
        } catch (e) {
          debugPrint('Error processing order data: $e');
          debugPrint('Order data keys: ${orderData.keys}');
          throw Exception('Error processing order response: $e');
        }
      } else {
        // API error - try to parse error message
        String errorMsg = 'Failed to create order';
        try {
          final errorData = jsonDecode(response.body);
          if (errorData['error'] != null) {
            errorMsg = errorData['error'] as String;
          } else {
            errorMsg = 'HTTP ${response.statusCode}: ${response.body}';
          }
        } catch (e) {
          errorMsg = 'HTTP ${response.statusCode}: ${response.body}';
        }
        throw Exception(errorMsg);
      }
    } on SocketException catch (e) {
      debugPrint('Network error creating order: $e');
      throw Exception(
        'Cannot connect to backend. Check:\n1. Backend is running on port 4000\n2. API URL is correct (use 10.0.2.2 for Android emulator)\n3. Firewall allows connections',
      );
    } on FormatException catch (e) {
      debugPrint('Format error creating order: $e');
      throw Exception('Invalid response from server: $e');
    } catch (e) {
      debugPrint('Error creating order: $e');
      if (e.toString().contains('timeout') ||
          e.toString().contains('Connection')) {
        rethrow;
      }
      throw Exception('Failed to create order: ${e.toString()}');
    }
  }

  Future<void> updateOrderStatus(String orderId, OrderStatus status) async {
    final index = _orders.indexWhere((order) => order.id == orderId);
    if (index >= 0) {
      final order = _orders[index];
      _orders[index] = Order(
        id: order.id,
        orderNumber: order.orderNumber,
        items: order.items,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        customerCity: order.customerCity,
        customerDistrict: order.customerDistrict,
        paymentMethod: order.paymentMethod,
        status: status,
        orderDate: order.orderDate,
      );
      notifyListeners();
      await _saveOrders();
    }
  }

  Order? getOrderById(String orderId) {
    try {
      return _orders.firstWhere((order) => order.id == orderId);
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, String>?> getCustomerInfo() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final customerJson = prefs.getString(_customerInfoKey);
      if (customerJson != null) {
        final Map<String, dynamic> decoded = json.decode(customerJson);
        return {
          'name': decoded['name'] as String,
          'phone': decoded['phone'] as String,
          'address': decoded['address'] as String,
          'city': decoded['city'] as String,
          'district': (decoded['district'] ?? decoded['zip']) as String? ?? '',
        };
      }
    } catch (e) {
      debugPrint('Error loading customer info: $e');
    }
    return null;
  }

  Future<void> _saveCustomerInfo(
    String name,
    String phone,
    String address,
    String city,
    String district,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final customerInfo = {
        'name': name,
        'phone': phone,
        'address': address,
        'city': city,
        'district': district,
      };
      final customerJson = json.encode(customerInfo);
      await prefs.setString(_customerInfoKey, customerJson);
    } catch (e) {
      debugPrint('Error saving customer info: $e');
    }
  }

  // Helper function to parse order status from backend
  OrderStatus _parseOrderStatus(dynamic statusValue) {
    if (statusValue == null) return OrderStatus.pending;

    if (statusValue is String) {
      switch (statusValue.toLowerCase()) {
        case 'pending':
          return OrderStatus.pending;
        case 'processing':
          return OrderStatus.processing;
        case 'delivered':
          return OrderStatus.delivered;
        default:
          return OrderStatus.pending;
      }
    }

    // If it's a number (index), convert it
    if (statusValue is int) {
      if (statusValue >= 0 && statusValue < OrderStatus.values.length) {
        return OrderStatus.values[statusValue];
      }
    }

    return OrderStatus.pending;
  }

  // Helper function to parse order date from backend
  DateTime _parseOrderDate(dynamic dateValue) {
    if (dateValue == null) {
      return DateTime.now();
    }
    try {
      if (dateValue is String) {
        // Try parsing ISO format first
        try {
          return DateTime.parse(dateValue);
        } catch (e) {
          // Try MySQL DATETIME format: "YYYY-MM-DD HH:MM:SS"
          try {
            return DateTime.parse(dateValue.replaceAll(' ', 'T'));
          } catch (e2) {
            debugPrint('Error parsing date: $dateValue');
            return DateTime.now();
          }
        }
      }
      return DateTime.now();
    } catch (e) {
      debugPrint('Error parsing order date: $e');
      return DateTime.now();
    }
  }
}
