import 'cart_item.dart';

enum OrderStatus { pending, processing, delivered, expired, failed, cancelled }

class Order {
  final String id;
  final String orderNumber;
  final List<CartItem> items;
  final double subtotal;
  final double shipping;
  final double total;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final String customerCity;
  final String customerDistrict;
  final String paymentMethod;
  final OrderStatus status;
  final DateTime orderDate;

  Order({
    required this.id,
    required this.orderNumber,
    required this.items,
    required this.subtotal,
    required this.shipping,
    required this.total,
    required this.customerName,
    required this.customerPhone,
    required this.customerAddress,
    required this.customerCity,
    required this.customerDistrict,
    required this.paymentMethod,
    required this.status,
    required this.orderDate,
  });

  String get statusText {
    switch (status) {
      case OrderStatus.pending:
        return 'Pending';
      case OrderStatus.processing:
        return 'Processing';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.expired:
        return 'Expired';
      case OrderStatus.failed:
        return 'Failed';
      case OrderStatus.cancelled:
        return 'Cancelled';
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'orderNumber': orderNumber,
      'items': items.map((item) => item.toJson()).toList(),
      'subtotal': subtotal,
      'shipping': shipping,
      'total': total,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'customerAddress': customerAddress,
      'customerCity': customerCity,
      'customerDistrict': customerDistrict,
      'paymentMethod': paymentMethod,
      'status': status.index,
      'orderDate': orderDate.toIso8601String(),
    };
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      items: (json['items'] as List)
          .map((item) => CartItem.fromJson(item))
          .toList(),
      subtotal: (json['subtotal'] as num).toDouble(),
      shipping: (json['shipping'] as num).toDouble(),
      total: (json['total'] as num).toDouble(),
      customerName: json['customerName'] as String,
      customerPhone: json['customerPhone'] as String,
      customerAddress: json['customerAddress'] as String,
      customerCity: json['customerCity'] as String,
      customerDistrict:
          (json['customerDistrict'] ?? json['customerZip']) as String,
      paymentMethod: json['paymentMethod'] as String,
      status: OrderStatus.values[json['status'] as int],
      orderDate: DateTime.parse(json['orderDate'] as String),
    );
  }
}
