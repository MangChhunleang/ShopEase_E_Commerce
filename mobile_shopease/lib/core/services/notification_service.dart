import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification.dart';

class NotificationService extends ChangeNotifier {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static const String _notificationsKey = 'app_notifications';
  List<AppNotification> _notifications = [];
  int _unreadCount = 0;

  List<AppNotification> get notifications => List.unmodifiable(_notifications);
  int get unreadCount => _unreadCount;
  bool get hasUnread => _unreadCount > 0;

  // Load notifications from local storage
  Future<void> loadNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final notificationsJson = prefs.getString(_notificationsKey);
      if (notificationsJson != null) {
        final List<dynamic> decoded = json.decode(notificationsJson);
        _notifications = decoded
            .map((json) => AppNotification.fromJson(json))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt)); // Newest first
        
        _updateUnreadCount();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading notifications: $e');
    }
  }

  // Save notifications to local storage
  Future<void> _saveNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final notificationsJson = json.encode(
        _notifications.map((n) => n.toJson()).toList(),
      );
      await prefs.setString(_notificationsKey, notificationsJson);
    } catch (e) {
      debugPrint('Error saving notifications: $e');
    }
  }

  // Update unread count
  void _updateUnreadCount() {
    _unreadCount = _notifications.where((n) => !n.isRead).length;
  }

  // Add a new notification
  Future<void> addNotification({
    required NotificationType type,
    required String title,
    required String message,
    Map<String, dynamic>? data,
  }) async {
    final notification = AppNotification(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      type: type,
      title: title,
      message: message,
      createdAt: DateTime.now(),
      isRead: false,
      data: data,
    );

    _notifications.insert(0, notification); // Add to beginning
    _updateUnreadCount();
    notifyListeners();
    await _saveNotifications();

    debugPrint('Notification added: $title');
  }

  // Mark notification as read
  Future<void> markAsRead(String notificationId) async {
    final index = _notifications.indexWhere((n) => n.id == notificationId);
    if (index != -1) {
      _notifications[index] = _notifications[index].copyWith(isRead: true);
      _updateUnreadCount();
      notifyListeners();
      await _saveNotifications();
    }
  }

  // Mark all as read
  Future<void> markAllAsRead() async {
    _notifications = _notifications
        .map((n) => n.copyWith(isRead: true))
        .toList();
    _updateUnreadCount();
    notifyListeners();
    await _saveNotifications();
  }

  // Delete notification
  Future<void> deleteNotification(String notificationId) async {
    _notifications.removeWhere((n) => n.id == notificationId);
    _updateUnreadCount();
    notifyListeners();
    await _saveNotifications();
  }

  // Clear all notifications
  Future<void> clearAll() async {
    _notifications.clear();
    _unreadCount = 0;
    notifyListeners();
    await _saveNotifications();
  }

  // Get notifications by type
  List<AppNotification> getNotificationsByType(NotificationType type) {
    return _notifications.where((n) => n.type == type).toList();
  }

  // Create order update notification
  Future<void> notifyOrderUpdate({
    required String orderNumber,
    required String status,
    int? orderId,
  }) async {
    String title;
    String message;
    NotificationType type;

    switch (status.toLowerCase()) {
      case 'processing':
        title = 'Order Processing';
        message = 'Your order $orderNumber is now being processed';
        type = NotificationType.orderProcessing;
        break;
      case 'delivered':
        title = 'Order Delivered! 🎉';
        message = 'Your order $orderNumber has been delivered';
        type = NotificationType.orderDelivered;
        break;
      default:
        title = 'Order Updated';
        message = 'Your order $orderNumber status has been updated to $status';
        type = NotificationType.orderUpdate;
    }

    await addNotification(
      type: type,
      title: title,
      message: message,
      data: orderId != null ? {'orderId': orderId, 'orderNumber': orderNumber} : null,
    );
  }
}

