class CartItem {
  final String id;
  final String name;
  final String imageUrl;
  final String price;
  final int quantity;
  final String? color;
  final String? offer;

  CartItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    this.quantity = 1,
    this.color,
    this.offer,
  });

  CartItem copyWith({
    String? id,
    String? name,
    String? imageUrl,
    String? price,
    int? quantity,
    String? color,
    String? offer,
  }) {
    return CartItem(
      id: id ?? this.id,
      name: name ?? this.name,
      imageUrl: imageUrl ?? this.imageUrl,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      color: color ?? this.color,
      offer: offer ?? this.offer,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'imageUrl': imageUrl,
      'price': price,
      'quantity': quantity,
      'color': color,
      'offer': offer,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'] as String,
      name: json['name'] as String,
      imageUrl: json['imageUrl'] as String,
      price: json['price'] as String,
      quantity: json['quantity'] as int? ?? 1,
      color: json['color'] as String?,
      offer: json['offer'] as String?,
    );
  }

  double get totalPrice {
    final priceValue = double.tryParse(price.replaceAll(RegExp(r'[^\d.]'), '')) ?? 0.0;
    return priceValue * quantity;
  }
}

