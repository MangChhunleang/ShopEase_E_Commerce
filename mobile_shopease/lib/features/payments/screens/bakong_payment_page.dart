import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../theme/app_theme.dart';
import '../../../config/api_config.dart';
import '../../../core/services/auth_service.dart';
import '../../orders/screens/order_confirmation_page.dart';

class BakongPaymentPage extends StatefulWidget {
  final String orderId;
  final String orderNumber;
  final double totalAmount;

  const BakongPaymentPage({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.totalAmount,
  });

  @override
  State<BakongPaymentPage> createState() => _BakongPaymentPageState();
}

class _BakongPaymentPageState extends State<BakongPaymentPage> {
  Map<String, dynamic>? _qrData;
  bool _isLoading = true;
  String? _error;
  bool _isCheckingPayment = false;
  Timer? _pollingTimer;
  Timer? _countdownTimer;
  bool _paymentConfirmed = false;
  int _pollingCount = 0;
  int _secondsRemaining = 0;
  bool _isExpired = false;
  // Reduced polling frequency since webhooks handle instant updates
  // Polling is now just a fallback/verification mechanism
  static const int _pollingIntervalSeconds =
      15; // Check every 15 seconds (reduced from 10)
  static const int _maxPollingAttempts =
      40; // Stop after 10 minutes (40 * 15 seconds)

  // Bakong app deep link schemes
  // Format: bakong://pay?data=<QR_STRING>
  static const String _bakongAppScheme = 'bakong://';

  @override
  void initState() {
    super.initState();
    _loadQRCode();
  }

  Future<void> _openBakongApp() async {
    if (_qrData == null || _qrData!['qrString'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('QR code not ready yet. Please wait...'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      final qrString = _qrData!['qrString'].toString();

      // Bakong deep link formats to try:
      // 1. bakong://pay?data=<QR_STRING>
      // 2. bakong://<QR_STRING>
      // 3. Universal link format

      final encodedQrString = Uri.encodeComponent(qrString);

      // Try multiple deep link formats
      final deepLinkFormats = [
        Uri.parse('https://bakong.nbc.gov.kh/pay?qr=$encodedQrString'),
        Uri.parse('https://bakong.nbc.gov.kh/pay?data=$encodedQrString'),
        Uri.parse('khqr://pay?qr=$encodedQrString'),
        Uri.parse('${_bakongAppScheme}pay?data=$encodedQrString'),
        Uri.parse('${_bakongAppScheme}scan?qr=$encodedQrString'),
        Uri.parse('$_bakongAppScheme$qrString'),
        Uri.parse('${_bakongAppScheme}qr?data=$encodedQrString'),
      ];

      bool launched = false;
      for (final uri in deepLinkFormats) {
        try {
          if (await canLaunchUrl(uri)) {
            launched = await launchUrl(
              uri,
              mode: LaunchMode.externalApplication,
            );
            if (launched) {
              debugPrint('Successfully opened Bakong app with URI: $uri');
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Opening Bakong app...'),
                    backgroundColor: Colors.green,
                    duration: Duration(seconds: 1),
                  ),
                );
              }
              return;
            }
          }
        } catch (e) {
          debugPrint('Failed to launch with URI $uri: $e');
          continue;
        }
      }

      // If all formats fail, show helpful message
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Bakong app not found. Please scan the QR code below or install Bakong app.',
            ),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error opening Bakong app: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Unable to open Bakong app. Please scan the QR code instead.',
            ),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 3),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    // Start polling after a short delay (3 seconds) to let user see the QR code
    // Note: Webhooks handle instant updates on the backend, so polling is just a fallback
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && !_paymentConfirmed) {
        _pollingTimer = Timer.periodic(
          const Duration(seconds: _pollingIntervalSeconds),
          (timer) {
            if (!mounted || _paymentConfirmed) {
              timer.cancel();
              return;
            }

            _pollingCount++;
            if (_pollingCount >= _maxPollingAttempts) {
              // Stop polling after max attempts
              timer.cancel();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Payment check timeout. Please check manually or contact support.',
                    ),
                    duration: Duration(seconds: 3),
                  ),
                );
              }
              return;
            }

            // Silent check - webhooks handle instant updates, this is just verification
            _checkPaymentStatus(silent: true);
          },
        );
      }
    });
  }

  void _stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  void _startCountdown() {
    _countdownTimer?.cancel();

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _paymentConfirmed) {
        timer.cancel();
        return;
      }

      setState(() {
        if (_secondsRemaining > 0) {
          _secondsRemaining--;
        } else {
          _isExpired = true;
          timer.cancel();
          _stopPolling();
        }
      });
    });
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _regenerateQRCode() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
        _isExpired = false;
      });

      final authService = AuthService();
      final token = authService.token;

      final headers = <String, String>{'Content-Type': 'application/json'};

      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final url =
          '${ApiConfig.apiBaseUrl}/orders/${widget.orderId}/bakong-qr/regenerate';
      debugPrint('Regenerating Bakong QR code from: $url');

      final response = await http
          .post(Uri.parse(url), headers: headers)
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              throw Exception('Connection timeout');
            },
          );

      debugPrint('Regenerate QR Code response status: ${response.statusCode}');
      debugPrint('Regenerate QR Code response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _qrData = data;
          _isLoading = false;
          _isExpired = data['isExpired'] ?? false;
          _secondsRemaining = data['secondsRemaining'] ?? 0;
        });

        // Restart countdown
        if (!_isExpired && _secondsRemaining > 0) {
          _startCountdown();
        }

        // Restart polling
        _startPolling();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('QR code regenerated successfully'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        final errorData = jsonDecode(response.body);
        setState(() {
          _error = errorData['error'] ?? 'Failed to regenerate QR code';
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error regenerating QR code: $e');
      setState(() {
        _error = 'Failed to regenerate QR code: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadQRCode() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final authService = AuthService();
      final token = authService.token;

      final headers = <String, String>{'Content-Type': 'application/json'};

      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final url = '${ApiConfig.apiBaseUrl}/orders/${widget.orderId}/bakong-qr';
      debugPrint('Fetching Bakong QR code from: $url');

      final response = await http
          .get(Uri.parse(url), headers: headers)
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              throw Exception('Connection timeout');
            },
          );

      debugPrint('QR Code response status: ${response.statusCode}');
      debugPrint('QR Code response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _qrData = data;
          _isLoading = false;
          _isExpired = data['isExpired'] ?? false;
          _secondsRemaining = data['secondsRemaining'] ?? 0;
        });

        // Start countdown timer if QR code is not expired
        if (!_isExpired && _secondsRemaining > 0) {
          _startCountdown();
        }

        // Start automatic polling after QR code is loaded
        _startPolling();
      } else if (response.statusCode == 401) {
        setState(() {
          _error = 'Please login to view payment QR code';
          _isLoading = false;
        });
      } else {
        final errorData = jsonDecode(response.body);
        setState(() {
          _error = errorData['error'] ?? 'Failed to load QR code';
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading QR code: $e');
      setState(() {
        _error = 'Failed to load QR code: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _checkPaymentStatus({bool silent = false}) async {
    // Don't check if payment already confirmed
    if (_paymentConfirmed) return;

    try {
      if (!silent) {
        setState(() {
          _isCheckingPayment = true;
        });
      }

      final authService = AuthService();
      final token = authService.token;

      final headers = <String, String>{'Content-Type': 'application/json'};

      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final url =
          '${ApiConfig.apiBaseUrl}/orders/${widget.orderId}/bakong-status';
      final response = await http
          .get(Uri.parse(url), headers: headers)
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final paymentStatus = data['paymentStatus'] as String?;
        final orderStatus = data['orderStatus'] as String?;

        debugPrint(
          'DEBUG: Payment Check - OrderID: ${widget.orderId}, PaymentStatus: $paymentStatus, OrderStatus: $orderStatus',
        );

        // Check if payment is completed or order status changed
        // Webhooks update the backend instantly, so this check confirms the update
        if (paymentStatus == 'completed' ||
            orderStatus == 'processing' ||
            orderStatus == 'delivered') {
          // Payment completed (likely via webhook), stop polling and navigate
          _paymentConfirmed = true;
          _stopPolling();

          if (mounted) {
            debugPrint(
              'DEBUG: Payment Confirmed! Navigating to success page...',
            );

            if (!silent) {
              // Manual check - show success dialog first
              await showDialog(
                context: context,
                barrierDismissible: false,
                builder: (context) => AlertDialog(
                  title: Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.green),
                      SizedBox(width: 8),
                      Text('Payment Confirmed!'),
                    ],
                  ),
                  content: Text('Your payment has been received successfully.'),
                  actions: [
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).pop(); // Close dialog
                        // Navigate to confirmation page
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(
                            builder: (context) =>
                                OrderConfirmationPage(orderId: widget.orderId),
                          ),
                        );
                      },
                      child: Text('Continue'),
                    ),
                  ],
                ),
              );
            } else {
              // Silent check - just navigate immediately
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(
                  builder: (context) =>
                      OrderConfirmationPage(orderId: widget.orderId),
                ),
              );
            }
          }
        } else if (paymentStatus == 'expired' || orderStatus == 'expired') {
          // Payment expired
          _stopPolling();
          setState(() {
            _isExpired = true;
            _secondsRemaining = 0;
          });

          if (mounted && !silent) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'QR Code has expired. Please regenerate to continue.',
                ),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 3),
              ),
            );
          }
        } else if (paymentStatus == 'failed' || orderStatus == 'failed') {
          // Payment failed
          _stopPolling();
          setState(() {
            _error = 'Payment failed. Please try again.';
          });
        } else {
          // Still pending - webhook hasn't arrived yet or payment not completed
          // Only show message if manual check
          if (!silent && mounted) {
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: Text('Payment Pending'),
                content: Text(
                  'We haven\'t received your payment yet. If you have already paid, please wait a moment and try again so the system can update.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: Text('OK'),
                  ),
                ],
              ),
            );
          }
        }
      }
    } catch (e) {
      debugPrint('Error checking payment status: $e');
      // Only show error if manual check (not silent polling)
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error checking payment: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (!silent) {
        setState(() {
          _isCheckingPayment = false;
        });
      }
    }
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.grey[300]!, width: 0.8),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.black, size: 24),
            onPressed: () async {
              final shouldPop = await _onWillPop();
              if (shouldPop && mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
          const Expanded(
            child: Text(
              'Bakong Payment',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }

  Widget _buildQRCode() {
    if (_qrData == null) return const SizedBox();

    // For now, display QR data as text
    // In production, use a QR code library to generate visual QR code
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 1,
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // QR Code Display
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[300]!, width: 2),
            ),
            child: Column(
              children: [
                // Actual QR Code
                if (_qrData!['qrString'] != null &&
                    _qrData!['qrString'].toString().isNotEmpty)
                  QrImageView(
                    data: _qrData!['qrString'].toString(),
                    version: QrVersions.auto,
                    size: 200.0,
                    backgroundColor: Colors.white,
                    errorCorrectionLevel: QrErrorCorrectLevel.M,
                  )
                else
                  Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.error_outline,
                          size: 48,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'QR Code not available',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),

                // Correct Bakong Integration Strategy:
                // 1. Show KHQR code (already done above)
                // 2. Instruct user to scan with Bakong app
                // 3. Do not rely on deep links (unreliable)
                const SizedBox(height: 24),
                const SizedBox(height: 24),

                const SizedBox(height: 24),

                // Show waiting indicator
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBlue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppTheme.primaryBlue.withOpacity(0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.primaryBlue,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Waiting for payment confirmation...',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: AppTheme.primaryBlue,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_secondsRemaining > 0 && !_isExpired) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _secondsRemaining < 60
                          ? Colors.red[50]
                          : Colors.orange[50],
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: _secondsRemaining < 60
                            ? Colors.red[300]!
                            : Colors.orange[300]!,
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.timer_outlined,
                          size: 16,
                          color: _secondsRemaining < 60
                              ? Colors.red[700]
                              : Colors.orange[700],
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Expires in: ${_formatTime(_secondsRemaining)}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: _secondsRemaining < 60
                                ? Colors.red[700]
                                : Colors.orange[700],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_isExpired) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.red[300]!, width: 1.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 16,
                          color: Colors.red,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'QR Code Expired',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.red[700],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          // Payment Details
          _buildPaymentDetail('Order Number', widget.orderNumber),
          const SizedBox(height: 12),
          _buildPaymentDetail(
            'Amount (USD)',
            '\$${widget.totalAmount.toStringAsFixed(2)}',
          ),
          if (_qrData!['amount'] != null) ...[
            const SizedBox(height: 12),
            _buildPaymentDetail('Amount (KHR)', '${_qrData!['amount']} KHR'),
          ],
        ],
      ),
    );
  }

  Widget _buildPaymentDetail(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 14, color: Colors.grey[600])),
        Text(
          value,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
      ],
    );
  }

  Future<bool> _onWillPop() async {
    if (_paymentConfirmed) return true;

    final shouldPop = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Payment?'),
        content: const Text(
          'Your payment is currently processing. Are you sure you want to cancel? The order will remain pending.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('No, Wait'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    return shouldPop ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: Colors.grey[100],
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      const SizedBox(height: 24),
                      if (_isLoading)
                        const Padding(
                          padding: EdgeInsets.all(32.0),
                          child: CircularProgressIndicator(),
                        )
                      else if (_error != null)
                        Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              Icon(
                                Icons.error_outline,
                                size: 64,
                                color: Colors.red[300],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey[700],
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadQRCode,
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        )
                      else ...[
                        _buildQRCode(),
                        if (_isExpired) ...[
                          const SizedBox(height: 16),
                          Container(
                            margin: const EdgeInsets.symmetric(horizontal: 16),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.red[50],
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.red[200]!),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.warning_amber_rounded,
                                      color: Colors.red[700],
                                      size: 24,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'QR Code has expired',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.red[700],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'The payment QR code has expired. Please regenerate a new QR code to continue.',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.red[700],
                                  ),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    onPressed: _regenerateQRCode,
                                    icon: const Icon(Icons.refresh, size: 20),
                                    label: const Text('Regenerate QR Code'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.red[600],
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 12,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 24),
                      ],
                    ],
                  ),
                ),
              ),
              if (!_isLoading && _error == null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 20,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      children: [
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: (_isCheckingPayment || _isExpired)
                                ? null
                                : _checkPaymentStatus,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _isExpired
                                  ? Colors.grey[400]
                                  : AppTheme.primaryBlue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: _isCheckingPayment
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        Colors.white,
                                      ),
                                    ),
                                  )
                                : Text(
                                    _isExpired
                                        ? 'QR Code Expired'
                                        : 'Check Payment Status',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
