import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' hide Category;
import '../../../theme/app_theme.dart';
import '../screens/products_page.dart';
import '../../../core/services/category_service.dart';
import '../../../core/services/product_service.dart';
import '../../../core/services/banner_service.dart';
import '../../../core/models/category.dart';
import '../../../core/models/banner.dart' as banner_model;
import '../screens/product_detail_page.dart';
import '../../../core/models/product.dart';
import '../../../config/api_config.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'dart:async';

class CategoriesPage extends StatefulWidget {
  const CategoriesPage({super.key});

  @override
  State<CategoriesPage> createState() => _CategoriesPageState();
}

class _CategoriesPageState extends State<CategoriesPage> {
  int _selectedCategoryIndex = 0;
  final CategoryService _categoryService = CategoryService();
  final BannerService _bannerService = BannerService();
  int _currentBannerIndex = 0;
  final CarouselSliderController _carouselController =
      CarouselSliderController();
  Timer? _carouselTimer;

  @override
  void initState() {
    super.initState();
    _categoryService.addListener(_onCategoriesChanged);
    _bannerService.addListener(_onBannersChanged);
    // Load cached data first, then fetch from API
    _categoryService.loadCachedCategories();
    _categoryService.fetchCategories();
    _bannerService.loadCachedBanners();
    _bannerService.fetchBanners(type: 'category');
    // Defer timer until after first frame so controller is attached
    WidgetsBinding.instance.addPostFrameCallback((_) => _startCarouselTimer());
  }

  @override
  void dispose() {
    _categoryService.removeListener(_onCategoriesChanged);
    _bannerService.removeListener(_onBannersChanged);
    _carouselTimer?.cancel();
    super.dispose();
  }

  void _onCategoriesChanged() {
    if (mounted) setState(() {});
  }

  void _onBannersChanged() {
    if (mounted) {
      setState(() {});
      if (_bannerService.categoryBanners.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _startCarouselTimer(),
        );
      }
    }
  }

  void _startCarouselTimer() {
    _carouselTimer?.cancel();
    final banners = _bannerService.categoryBanners;
    if (banners.isEmpty) return;

    _carouselTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (!mounted) return;

      if (_currentBannerIndex < banners.length - 1) {
        _currentBannerIndex++;
      } else {
        _currentBannerIndex = 0;
      }

      // Skip if controller not attached yet; timer will try again on next tick
      try {
        _carouselController.nextPage(
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOut,
        );
      } catch (_) {
        // Ignore if carousel is not ready/attached yet
      }
    });
  }

  void _handleBannerTap(banner_model.Banner banner) {
    if (banner.linkType == 'none') return;

    if (banner.linkType == 'product') {
      final productId = int.tryParse(banner.linkValue ?? '');
      if (productId != null) {
        final products = ProductService().products;
        try {
          final product = products.firstWhere((p) => p.id == productId);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProductDetailPage(product: product.toMap()),
            ),
          );
        } catch (e) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Product not found')));
        }
      }
    } else if (banner.linkType == 'category') {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ProductsPage(categoryTitle: banner.linkValue),
        ),
      );
    } else if (banner.linkType == 'url') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Opening: ${banner.linkValue ?? ''}')),
      );
    }
  }

  Widget _buildCategoryBannerCarousel(List<banner_model.Banner> banners) {
    if (banners.isEmpty) return const SizedBox.shrink();

    // Use a separate controller for category banners
    final controller = CarouselSliderController();
    int currentIndex = 0;

    return StatefulBuilder(
      builder: (context, setState) {
        return Column(
          children: [
            CarouselSlider.builder(
              carouselController: controller,
              itemCount: banners.length,
              itemBuilder: (context, index, realIndex) {
                final banner = banners[index];
                return GestureDetector(
                  onTap: () => _handleBannerTap(banner),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.grey.withOpacity(0.2),
                          spreadRadius: 2,
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        ApiConfig.processImageUrl(banner.mobileImageUrl),
                        width: double.infinity,
                        height: 100,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            height: 100,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              gradient: const LinearGradient(
                                colors: [Color(0xFFE0E0E0), Color(0xFFBDBDBD)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: Center(
                              child: Icon(
                                Icons.image,
                                size: 40,
                                color: Colors.white70,
                              ),
                            ),
                          );
                        },
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return Container(
                            height: 100,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              color: Colors.grey[200],
                            ),
                            child: Center(
                              child: CircularProgressIndicator(
                                value:
                                    loadingProgress.expectedTotalBytes != null
                                    ? loadingProgress.cumulativeBytesLoaded /
                                          loadingProgress.expectedTotalBytes!
                                    : null,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
              options: CarouselOptions(
                height: 100,
                viewportFraction: 1.0,
                autoPlay: banners.length > 1,
                autoPlayInterval: const Duration(seconds: 3),
                autoPlayAnimationDuration: const Duration(milliseconds: 500),
                enlargeCenterPage: false,
                onPageChanged: (index, reason) {
                  setState(() {
                    currentIndex = index;
                  });
                },
              ),
            ),
            if (banners.length > 1) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  banners.length,
                  (index) => Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: currentIndex == index
                          ? Colors.blue
                          : Colors.grey[300],
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildProductCard(Product product) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ProductDetailPage(product: product.toMap()),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.1),
              spreadRadius: 1,
              blurRadius: 5,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product image
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    topRight: Radius.circular(12),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    topRight: Radius.circular(12),
                  ),
                  child: _buildProductImage(product.imageUrl),
                ),
              ),
            ),
            // Product info
            Flexible(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8.0,
                  vertical: 6.0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        product.name,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      product.formattedPrice,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryBlue,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductImage(String imageUrl) {
    // Process image URL to handle relative paths
    final processedUrl = ApiConfig.processImageUrl(imageUrl);

    // Check if it's a network URL or asset path
    final isNetworkUrl =
        processedUrl.startsWith('http://') ||
        processedUrl.startsWith('https://') ||
        processedUrl.startsWith('/uploads/');

    if (isNetworkUrl) {
      // Network image - handle relative URLs
      String fullUrl = processedUrl;
      if (processedUrl.startsWith('/uploads/')) {
        // Convert relative URL to full URL
        fullUrl = '${ApiConfig.apiBaseUrl.replaceAll('/api', '')}$processedUrl';
      }

      return Image.network(
        fullUrl,
        fit: BoxFit.cover,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            color: Colors.grey[200],
            child: Center(
              child: CircularProgressIndicator(
                value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded /
                          loadingProgress.expectedTotalBytes!
                    : null,
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          return Container(
            color: Colors.grey[200],
            child: Center(
              child: Icon(
                Icons.sports_soccer,
                size: 40,
                color: Colors.grey[400],
              ),
            ),
          );
        },
      );
    } else {
      return Image.asset(
        imageUrl,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            color: Colors.grey[200],
            child: Center(
              child: Icon(
                Icons.sports_soccer,
                size: 40,
                color: Colors.grey[400],
              ),
            ),
          );
        },
      );
    }
  }

  // Helper to parse color from hex
  Color _parseColor(String? colorHex) {
    if (colorHex == null || colorHex.isEmpty) return Colors.blue;
    try {
      String hex = colorHex.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (e) {
      return Colors.blue;
    }
  }

  IconData _resolveIcon(String? iconName) {
    if (iconName == null || iconName.trim().isEmpty) return Icons.category;
    final key = iconName
        .trim()
        .toLowerCase()
        .replaceAll(' ', '_')
        .replaceAll('-', '_');
    const iconMap = {
      'sports_soccer': Icons.sports_soccer,
      'soccer': Icons.sports_soccer,
      'football': Icons.sports_soccer,
      'sports_basketball': Icons.sports_basketball,
      'basketball': Icons.sports_basketball,
      'sports_volleyball': Icons.sports_volleyball,
      'volleyball': Icons.sports_volleyball,
      'sports_baseball': Icons.sports_baseball,
      'baseball': Icons.sports_baseball,
      'sports_tennis': Icons.sports_tennis,
      'tennis': Icons.sports_tennis,
      'sports_golf': Icons.sports_golf,
      'golf': Icons.sports_golf,
      'sports': Icons.sports,
      'fitness_center': Icons.fitness_center,
      'home': Icons.home_filled,
      'shopping_cart': Icons.shopping_cart,
      'shopping': Icons.shopping_bag,
      'tag': Icons.sell,
      'cube': Icons.category,
      'grid': Icons.grid_view,
      'sparkles': Icons.auto_awesome,
      'heart': Icons.favorite,
      'star': Icons.star,
      'gift': Icons.card_giftcard,
      'category': Icons.category,
    };
    return iconMap[key] ?? Icons.category;
  }

  // Get parent categories only (for sidebar)
  List<Category> get _parentCategories {
    return _categoryService.parentCategories;
  }

  // Get subcategories of selected parent
  List<Category> get _subcategories {
    if (_selectedCategoryIndex >= 0 &&
        _selectedCategoryIndex < _parentCategories.length) {
      final parent = _parentCategories[_selectedCategoryIndex];
      return _categoryService.getSubcategories(parent.id);
    }
    return [];
  }

  // Build category-specific content - now uses API categories
  Widget _buildCategoryContent() {
    if (_parentCategories.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Text('No categories available'),
        ),
      );
    }

    if (_selectedCategoryIndex >= 0 &&
        _selectedCategoryIndex < _parentCategories.length) {
      final parentCategory = _parentCategories[_selectedCategoryIndex];
      final subcategories = _subcategories;

      // ALWAYS show subcategories if they exist - products should only be in subcategories
      if (subcategories.isNotEmpty) {
        return _buildSubcategoriesView(parentCategory, subcategories);
      }

      // Only show products if this category has NO subcategories
      // This means it's either a subcategory itself, or an old category without subcategories
      return _buildCategoryProducts(parentCategory);
    }

    return _buildDailyOffersBanner();
  }

  Widget _buildSubcategoriesView(
    Category parentCategory,
    List<Category> subcategories,
  ) {
    // Get banners linked to this category
    final categoryBanners = _bannerService.categoryBanners
        .where(
          (banner) =>
              banner.linkType == 'category' &&
              banner.linkValue?.toLowerCase().trim() ==
                  parentCategory.name.toLowerCase().trim(),
        )
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category banner
        if (categoryBanners.isNotEmpty)
          _buildCategoryBannerCarousel(categoryBanners)
        else
          Container(
            height: 100,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: _parseColor(parentCategory.color),
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.2),
                  spreadRadius: 2,
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                parentCategory.name,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        const SizedBox(height: 16),
        // Description if available
        if (parentCategory.description != null &&
            parentCategory.description!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              parentCategory.description!,
              style: TextStyle(fontSize: 14, color: Colors.grey[700]),
            ),
          ),
        const SizedBox(height: 16),
        // Subcategories grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.95,
          ),
          itemCount: subcategories.length,
          itemBuilder: (context, index) {
            final subcategory = subcategories[index];
            return _buildSubcategoryCard(subcategory);
          },
        ),
      ],
    );
  }

  Widget _buildSubcategoryCard(Category subcategory) {
    final String? iconValue = subcategory.icon?.trim();
    final bool hasImageIcon =
        iconValue != null &&
        iconValue.isNotEmpty &&
        (iconValue.startsWith('http') || iconValue.startsWith('/uploads'));
    final IconData resolvedIcon = _resolveIcon(iconValue);
    String? processedImageUrl;
    if (hasImageIcon) {
      processedImageUrl = ApiConfig.processImageUrl(iconValue);
    }

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ProductsPage(categoryTitle: subcategory.name),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.1),
              spreadRadius: 1,
              blurRadius: 5,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: hasImageIcon
                    ? Colors.transparent
                    : _parseColor(subcategory.color),
                shape: hasImageIcon ? BoxShape.rectangle : BoxShape.circle,
                borderRadius: hasImageIcon ? BorderRadius.circular(30) : null,
              ),
              child: hasImageIcon && processedImageUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: Image.network(
                        processedImageUrl,
                        width: 60,
                        height: 60,
                        fit: BoxFit.cover,
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return Container(
                            width: 60,
                            height: 60,
                            color: Colors.grey[200],
                            child: Center(
                              child: CircularProgressIndicator(
                                value:
                                    loadingProgress.expectedTotalBytes != null
                                    ? loadingProgress.cumulativeBytesLoaded /
                                          loadingProgress.expectedTotalBytes!
                                    : null,
                              ),
                            ),
                          );
                        },
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: _parseColor(subcategory.color),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.category,
                              color: Colors.white,
                              size: 30,
                            ),
                          );
                        },
                      ),
                    )
                  : Icon(resolvedIcon, color: Colors.white, size: 30),
            ),
            const SizedBox(height: 6),
            Flexible(
              child: Text(
                subcategory.name,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 2),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryProducts(Category category) {
    // IMPORTANT: If this is a parent category with subcategories, show subcategories instead
    // This should not happen if logic is correct, but adding as safety check
    final subcategories = _categoryService.getSubcategories(category.id);
    if (subcategories.isNotEmpty) {
      return _buildSubcategoriesView(category, subcategories);
    }

    // Import ProductService to get products
    final productService = ProductService();
    final categoryProducts = productService.getProductsByCategory(
      category.name,
    );

    // Get banners linked to this category
    final categoryBanners = _bannerService.categoryBanners
        .where(
          (banner) =>
              banner.linkType == 'category' &&
              banner.linkValue?.toLowerCase().trim() ==
                  category.name.toLowerCase().trim(),
        )
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category-specific banner or fallback
        if (categoryBanners.isNotEmpty)
          _buildCategoryBannerCarousel(categoryBanners)
        else
          Container(
            height: 100,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: _parseColor(category.color),
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.2),
                  spreadRadius: 2,
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                category.name,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        const SizedBox(height: 16),
        // Description if available
        if (category.description != null && category.description!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              category.description!,
              style: TextStyle(fontSize: 14, color: Colors.grey[700]),
            ),
          ),
        const SizedBox(height: 16),
        // Products section
        if (categoryProducts.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${categoryProducts.length} product${categoryProducts.length != 1 ? 's' : ''}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[900],
                  ),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            ProductsPage(categoryTitle: category.name),
                      ),
                    );
                  },
                  child: Text(
                    'View All',
                    style: TextStyle(
                      color: _parseColor(category.color),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Product grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.75,
            ),
            itemCount: categoryProducts.length > 4
                ? 4
                : categoryProducts.length,
            itemBuilder: (context, index) {
              final product = categoryProducts[index];
              return _buildProductCard(product);
            },
          ),
        ] else ...[
          Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              children: [
                Icon(
                  Icons.inventory_2_outlined,
                  size: 64,
                  color: Colors.grey[400],
                ),
                const SizedBox(height: 16),
                Text(
                  'No products in this category',
                  style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildDailyOffersBanner() {
    final banners = _bannerService.banners;

    if (_bannerService.isLoading && banners.isEmpty) {
      return Container(
        height: 100,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: Colors.grey[200],
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (banners.isEmpty) {
      // Fallback placeholder if no banners
      return Container(
        height: 100,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: const LinearGradient(
            colors: [Color(0xFFE0E0E0), Color(0xFFBDBDBD)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.2),
              spreadRadius: 2,
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.image, size: 40, color: Colors.white70),
              const SizedBox(height: 4),
              Text(
                'No banners available',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        CarouselSlider.builder(
          carouselController: _carouselController,
          itemCount: banners.length,
          itemBuilder: (context, index, realIndex) {
            final banner = banners[index];
            return GestureDetector(
              onTap: () => _handleBannerTap(banner),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.2),
                      spreadRadius: 2,
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    ApiConfig.processImageUrl(banner.mobileImageUrl),
                    width: double.infinity,
                    height: 100,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        height: 100,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: const LinearGradient(
                            colors: [Color(0xFFE0E0E0), Color(0xFFBDBDBD)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Center(
                          child: Icon(
                            Icons.image,
                            size: 40,
                            color: Colors.white70,
                          ),
                        ),
                      );
                    },
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Container(
                        height: 100,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: Colors.grey[200],
                        ),
                        child: Center(
                          child: CircularProgressIndicator(
                            value: loadingProgress.expectedTotalBytes != null
                                ? loadingProgress.cumulativeBytesLoaded /
                                      loadingProgress.expectedTotalBytes!
                                : null,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            );
          },
          options: CarouselOptions(
            height: 100,
            viewportFraction: 1.0,
            autoPlay: false,
            enlargeCenterPage: false,
            onPageChanged: (index, reason) {
              setState(() {
                _currentBannerIndex = index;
              });
            },
          ),
        ),
        if (banners.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              banners.length,
              (index) => Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _currentBannerIndex == index
                      ? Colors.blue
                      : Colors.grey[300],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Top bar (same as Home)
        Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Colors.grey[300]!, width: 0.8),
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              // Search bar
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            const ProductsPage(searchQuery: ''),
                      ),
                    );
                  },
                  child: Container(
                    height: 35,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(25),
                      border: Border.all(
                        color: AppTheme.primaryBlue, // <-- border color here
                        width: 1.2, // <-- border width
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(width: 12),
                        Icon(Icons.search, color: Colors.grey[600], size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Search for products',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Main content
        Expanded(
          child: Row(
            children: [
              // Left category list
              Container(
                width: 100,
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  border: Border(
                    right: BorderSide(color: Colors.grey[300]!, width: 0.8),
                  ),
                ),
                child: _parentCategories.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : ListView.builder(
                        padding: EdgeInsets.zero,
                        itemCount: _parentCategories.length,
                        itemBuilder: (context, index) {
                          final category = _parentCategories[index];
                          return _CategoryMenuItem(
                            icon: _resolveIcon(category.icon ?? category.name),
                            label: category.name,
                            selected: index == _selectedCategoryIndex,
                            onTap: () {
                              setState(() {
                                _selectedCategoryIndex = index;
                              });
                            },
                          );
                        },
                      ),
              ),

              // Right side content (scrollable)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: ListView(
                    children: [
                      _buildCategoryContent(),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CategoryMenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryMenuItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Use the app's primary (blue) color so the category tab highlight
    // matches the main screen's blue theme.
    final Color selectedColor = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        color: selected ? Colors.white : Colors.transparent,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 24,
                color: selected ? selectedColor : Colors.grey[600],
              ),
              const SizedBox(height: 4),
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10,
                    color: selected ? selectedColor : Colors.grey[800],
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
