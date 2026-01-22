import 'dart:convert';
import '../../config/api_config.dart';

class Product {
  final int id;
  final String name;
  final String? description;
  final double price;
  final int stock;
  final String status;
  final List<String> images;
  final String? category;
  final String? offer;
  final String? color;

  Product({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    this.stock = 0,
    this.status = 'ACTIVE',
    this.images = const [],
    this.category,
    this.offer,
    this.color,
  });

  // Get first image URL or return placeholder
  String get imageUrl {
    if (images.isNotEmpty) {
      String url = images[0];
      // Convert relative URLs to absolute URLs for mobile app
      return ApiConfig.processImageUrl(url);
    }
    return 'assets/images/football.jpg'; // Default placeholder
  }
  
  // Get all image URLs with proper base URL conversion
  List<String> get imageUrls {
    if (images.isEmpty) {
      return ['assets/images/football.jpg'];
    }
    return images.map((url) => ApiConfig.processImageUrl(url)).toList();
  }

  // Get formatted price string
  String get formattedPrice {
    return '\$${price.toStringAsFixed(2)}';
  }

  // Check if product is available
  bool get isAvailable => status == 'ACTIVE' && stock > 0;

  // Convert to Map for compatibility with existing code
  Map<String, dynamic> toMap() {
    return {
      'id': id.toString(),
      'name': name,
      'description': description ?? '',
      'currentPrice': formattedPrice,
      'price': price,
      'offer': offer ?? description ?? '',
      'imageUrl': imageUrl,
      'images': images,
      'color': color,
      'category': category ?? 'Other Sports',
      'stock': stock,
      'status': status,
    };
  }

  // Convert to CartItem format
  Map<String, dynamic> toCartItemMap() {
    return {
      'id': id.toString(),
      'name': name,
      'imageUrl': imageUrl,
      'price': formattedPrice,
      'color': color,
      'offer': offer,
    };
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    // Parse images - can be array or JSON string
    List<String> imagesList = [];
    if (json['images'] != null) {
      if (json['images'] is List) {
        imagesList = (json['images'] as List)
            .map((e) => e.toString())
            .where((s) => s.isNotEmpty)
            .toList();
      } else if (json['images'] is String) {
        try {
          final parsed = json['images'] as String;
          if (parsed.trim().startsWith('[') && parsed.trim().endsWith(']')) {
            // It's a JSON string, parse it properly
            final decoded = jsonDecode(parsed) as List;
            imagesList = decoded
                .map((e) => e.toString())
                .where((s) => s.isNotEmpty)
                .toList();
          } else if (parsed.trim().isNotEmpty) {
            // Single image URL string
            imagesList = [parsed];
          }
        } catch (e) {
          // If JSON parsing fails, try simple string parsing
          final parsed = json['images'] as String;
          if (parsed.trim().isNotEmpty) {
            imagesList = [parsed];
          }
        }
      }
    }

    // Parse price - can be number, string, or Decimal
    double priceValue = 0.0;
    if (json['price'] != null) {
      if (json['price'] is num) {
        priceValue = (json['price'] as num).toDouble();
      } else if (json['price'] is String) {
        priceValue = double.tryParse(json['price']) ?? 0.0;
      }
    }

    return Product(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: priceValue,
      stock: json['stock'] as int? ?? 0,
      status: json['status'] as String? ?? 'ACTIVE',
      images: imagesList,
      category: json['category'] as String?,
      offer: json['offer'] as String?,
      color: json['color'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'stock': stock,
      'status': status,
      'images': images,
      'category': category,
      'offer': offer,
      'color': color,
    };
  }
}

