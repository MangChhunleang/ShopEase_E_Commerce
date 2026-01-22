class Category {
  final int id;
  final String name;
  final String? description;
  final String? icon;
  final String? color;
  final String? logoUrl;
  final int? parentCategoryId;

  Category({
    required this.id,
    required this.name,
    this.description,
    this.icon,
    this.color,
    this.logoUrl,
    this.parentCategoryId,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    // Handle parentCategoryId - it might be int, null, or not present
    int? parentId;
    if (json['parentCategoryId'] != null) {
      if (json['parentCategoryId'] is int) {
        parentId = json['parentCategoryId'] as int;
      } else if (json['parentCategoryId'] is String) {
        parentId = int.tryParse(json['parentCategoryId'] as String);
      }
    }

    return Category(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      icon: json['icon'] as String?,
      color: json['color'] as String?,
      logoUrl: json['logoUrl'] as String?,
      parentCategoryId: parentId,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'icon': icon,
      'color': color,
      'logoUrl': logoUrl,
      'parentCategoryId': parentCategoryId,
    };
  }

  bool get isSubcategory => parentCategoryId != null;
  bool get isParent => parentCategoryId == null;
}
