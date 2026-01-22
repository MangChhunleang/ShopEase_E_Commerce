import 'package:flutter/material.dart';
import 'wishlist_page.dart';
import '../../orders/screens/order_history_page.dart';
import 'settings_page.dart';
import '../../notifications/screens/notifications_page.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/services/order_service.dart';
import '../../../core/models/order.dart';
import '../../../theme/app_theme.dart';

class AccountPage extends StatefulWidget {
  const AccountPage({super.key});

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final NotificationService _notificationService = NotificationService();
  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _notificationService.addListener(_onNotificationsChanged);
    _authService.addListener(_onAuthChanged);
  }

  @override
  void dispose() {
    _notificationService.removeListener(_onNotificationsChanged);
    _authService.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onNotificationsChanged() {
    if (mounted) setState(() {});
  }

  void _onAuthChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.grey[100],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Account',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.black,
                  ),
                ),
                Stack(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.notifications_outlined),
                      color: AppTheme.primaryBlue,
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const NotificationsPage(),
                          ),
                        );
                      },
                    ),
                    if (_notificationService.unreadCount > 0)
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 16,
                            minHeight: 16,
                          ),
                          child: Text(
                            _notificationService.unreadCount > 9
                                ? '9+'
                                : '${_notificationService.unreadCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          // Scrollable content
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 20),
                  // User Profile Section
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        // Avatar
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const SettingsPage(),
                              ),
                            );
                          },
                          child: Builder(
                            builder: (context) {
                              final profileImageUrl =
                                  _authService.profileImageUrl;
                              return Container(
                                width: 70,
                                height: 70,
                                decoration: BoxDecoration(
                                  gradient: profileImageUrl == null
                                      ? LinearGradient(
                                          colors: [
                                            AppTheme.primaryBlue.withOpacity(
                                              0.8,
                                            ),
                                            AppTheme.primaryBlue,
                                          ],
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        )
                                      : null,
                                  color: profileImageUrl != null
                                      ? Colors.transparent
                                      : null,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppTheme.primaryBlue.withOpacity(
                                        0.3,
                                      ),
                                      spreadRadius: 2,
                                      blurRadius: 8,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                  image: profileImageUrl != null
                                      ? DecorationImage(
                                          image: NetworkImage(profileImageUrl),
                                          fit: BoxFit.cover,
                                          onError: (exception, stackTrace) {
                                            // Fallback handled by null check
                                          },
                                        )
                                      : null,
                                ),
                                child: profileImageUrl == null
                                    ? const Icon(
                                        Icons.person,
                                        size: 40,
                                        color: Colors.white,
                                      )
                                    : null,
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 16),
                        // User info
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                AuthService().email ??
                                    AuthService().currentPhoneNumber ??
                                    'Guest User',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  // My Orders Section
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.grey.withOpacity(0.1),
                            spreadRadius: 1,
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.receipt_long,
                                    size: 20,
                                    color: AppTheme.primaryBlue,
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'My Orders',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black,
                                    ),
                                  ),
                                ],
                              ),
                              GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) =>
                                          const OrderHistoryPage(),
                                    ),
                                  );
                                },
                                child: Text(
                                  'See All',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: AppTheme.primaryBlue,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          FutureBuilder<Map<String, int>>(
                            future: _getOrderCounts(),
                            builder: (context, snapshot) {
                              final counts =
                                  snapshot.data ??
                                  {
                                    'pending': 0,
                                    'processing': 0,
                                    'delivered': 0,
                                    'total': 0,
                                  };

                              return Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceAround,
                                children: [
                                  _buildOrderStatusItem(
                                    icon: Icons.pending_outlined,
                                    label: 'Pending',
                                    count: counts['pending'] ?? 0,
                                    onTap: () => _navigateToOrders('pending'),
                                  ),
                                  _buildOrderStatusItem(
                                    icon: Icons.local_shipping_outlined,
                                    label: 'Processing',
                                    count: counts['processing'] ?? 0,
                                    onTap: () =>
                                        _navigateToOrders('processing'),
                                  ),
                                  _buildOrderStatusItem(
                                    icon: Icons.check_circle_outline,
                                    label: 'Delivered',
                                    count: counts['delivered'] ?? 0,
                                    onTap: () => _navigateToOrders('delivered'),
                                  ),
                                  _buildOrderStatusItem(
                                    icon: Icons.receipt_long_outlined,
                                    label: 'All Orders',
                                    count: counts['total'] ?? 0,
                                    onTap: () => _navigateToOrders('all'),
                                  ),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Account Options Section
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.grey.withOpacity(0.1),
                            spreadRadius: 1,
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          _buildAccountOptionItem(
                            icon: Icons.favorite_border,
                            label: 'My Wishlist',
                            iconColor: Colors.red,
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const WishlistPage(),
                                ),
                              );
                            },
                          ),
                          _buildDivider(),
                          _buildAccountOptionItem(
                            icon: Icons.settings_outlined,
                            label: 'Settings',
                            iconColor: Colors.grey[700],
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const SettingsPage(),
                                ),
                              );
                            },
                          ),
                          _buildDivider(),
                          _buildAccountOptionItem(
                            icon: Icons.headset_mic_outlined,
                            label: 'Contact Us',
                            iconColor: AppTheme.primaryBlue,
                            onTap: () {
                              // Show contact options
                              showDialog(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: const Text('Contact Us'),
                                  content: const Text(
                                    'Email: support@shopease.com\nPhone: +855 123 456 789',
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(context),
                                      child: const Text('Close'),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<Map<String, int>> _getOrderCounts() async {
    final orderService = OrderService();
    await orderService.syncOrdersFromBackend();
    final orders = orderService.orders;

    return {
      'pending': orders.where((o) => o.status == OrderStatus.pending).length,
      'processing': orders
          .where((o) => o.status == OrderStatus.processing)
          .length,
      'delivered': orders
          .where((o) => o.status == OrderStatus.delivered)
          .length,
      'total': orders.length,
    };
  }

  void _navigateToOrders(String filter) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const OrderHistoryPage()),
    );
  }

  Widget _buildOrderStatusItem({
    required IconData icon,
    required String label,
    int count = 0,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primaryBlue.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 24, color: AppTheme.primaryBlue),
              ),
              if (count > 0)
                Positioned(
                  right: -4,
                  top: -4,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 18,
                      minHeight: 18,
                    ),
                    child: Center(
                      child: Text(
                        count > 9 ? '9+' : '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey[700],
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildAccountOptionItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? iconColor,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: (iconColor ?? Colors.grey[700])!.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 20, color: iconColor ?? Colors.grey[700]),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
            ),
            Icon(Icons.chevron_right, size: 20, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      height: 1,
      thickness: 1,
      color: Colors.grey[200],
      indent: 56, // Align with text after icon
    );
  }
}
