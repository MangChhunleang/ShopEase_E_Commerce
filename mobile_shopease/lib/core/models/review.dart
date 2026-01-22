class Review {
  final int id;
  final int productId;
  final int? userId;
  final String? userName;
  final String? userEmail;
  final int rating; // 1-5
  final String? comment;
  final bool isApproved;
  final DateTime createdAt;
  final DateTime updatedAt;

  Review({
    required this.id,
    required this.productId,
    this.userId,
    this.userName,
    this.userEmail,
    required this.rating,
    this.comment,
    required this.isApproved,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] as int,
      productId: json['productId'] as int,
      userId: json['userId'] as int?,
      userName: json['userName'] as String?,
      userEmail: json['userEmail'] as String?,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      isApproved: json['isApproved'] == 1 || json['isApproved'] == true,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'productId': productId,
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'rating': rating,
      'comment': comment,
      'isApproved': isApproved,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

