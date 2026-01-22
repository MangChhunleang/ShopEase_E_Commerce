import 'package:flutter/material.dart' hide Banner;
import 'package:carousel_slider/carousel_slider.dart';
import 'dart:async';
import '../../../theme/app_theme.dart';
import '../../../config/api_config.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/services/category_service.dart';
import '../../../core/services/banner_service.dart';
import '../../../core/services/product_service.dart';
import '../../../core/models/product.dart';
import '../../../core/models/banner.dart';
import '../screens/categories_page.dart';
import '../screens/products_page.dart';
import '../screens/product_detail_page.dart';
import '../../cart/screens/cart_page.dart';
import '../../account/screens/account_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedIndex = 0;
  int _currentBannerIndex = 0;
  final CarouselSliderController _carouselController =
      CarouselSliderController();
  Timer? _carouselTimer;
  int _currentCategoryPage = 0;
  final PageController _categoryPageController = PageController();
  final CartService _cartService = CartService();
  final CategoryService _categoryService = CategoryService();
  final BannerService _bannerService = BannerService();

  Widget _buildTopBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Search bar
          Expanded(
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

              child: GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const ProductsPage(searchQuery: ''),
                    ),
                  );
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(width: 12),
                    Icon(Icons.search, color: Colors.grey[600], size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Search for products',
                      style: TextStyle(color: Colors.grey[600], fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    // Start auto-play carousel
    _startCarouselTimer();
    _cartService.addListener(_onCartChanged);
    _categoryService.addListener(_onCategoriesChanged);
    _bannerService.addListener(_onBannersChanged);

    // Fetch products, categories, and banners on home page load
    ProductService().fetchProducts();
    _categoryService.fetchCategories();
    _bannerService.loadCachedBanners();
    _bannerService.fetchBanners(type: 'home');
  }

  @override
  void dispose() {
    _cartService.removeListener(_onCartChanged);
    _categoryService.removeListener(_onCategoriesChanged);
    _bannerService.removeListener(_onBannersChanged);
    _carouselTimer?.cancel();
    _categoryPageController.dispose();
    super.dispose();
  }

  void _onCartChanged() {
    if (mounted) setState(() {});
  }

  void _onCategoriesChanged() {
    if (mounted) setState(() {});
  }

  void _onBannersChanged() {
    if (mounted) {
      setState(() {});
      // Restart carousel timer if banners changed
      if (_bannerService.homeBanners.isNotEmpty) {
        _startCarouselTimer();
      }
    }
  }

  void _startCarouselTimer() {
    // Always cancel existing timer before starting a new one
    _carouselTimer?.cancel();

    final banners = _bannerService.homeBanners;
    if (banners.isEmpty) return; // Don't start timer if no banners

    _carouselTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      // Only auto-scroll when on the Home tab and the widget is mounted
      if (!mounted || _selectedIndex != 0) return;

      if (_currentBannerIndex < banners.length - 1) {
        _currentBannerIndex++;
      } else {
        _currentBannerIndex = 0;
      }

      // Safely try to move to the next page; ignore if the carousel is not attached
      try {
        _carouselController.nextPage(
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOut,
        );
      } catch (_) {
        // Underlying PageView may not be built (e.g., when not visible); ignore
      }
    });
  }

  void _handleBannerTap(Banner banner) {
    if (banner.linkType == 'none') return;

    if (banner.linkType == 'product') {
      // Navigate to product detail page
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
      // Navigate to products page filtered by category
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ProductsPage(categoryTitle: banner.linkValue),
        ),
      );
    } else if (banner.linkType == 'url') {
      // Open external URL (you might want to use url_launcher package)
      // For now, just show a message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Opening: ${banner.linkValue ?? ''}')),
      );
    }
  }

  Widget _buildPromoBanner() {
    final banners = _bannerService.homeBanners;

    if (_bannerService.isLoading && banners.isEmpty) {
      return Container(
        height: 180,
        margin: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(15),
          color: Colors.grey[200],
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (banners.isEmpty) {
      // Fallback to a placeholder if no banners
      return Container(
        height: 180,
        margin: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(15),
          gradient: LinearGradient(
            colors: [Color(0xFFFFE5D9), Color(0xFFFFD4C4)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.image, size: 60, color: Colors.white70),
              const SizedBox(height: 8),
              Text(
                'No banners available',
                style: TextStyle(color: Colors.white70, fontSize: 14),
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
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
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
                  borderRadius: BorderRadius.circular(15),
                  child: Image.network(
                    ApiConfig.processImageUrl(banner.mobileImageUrl),
                    width: double.infinity,
                    height: 180,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      // Fallback to a gradient container if image fails to load
                      return Container(
                        height: 180,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(15),
                          gradient: LinearGradient(
                            colors: [Color(0xFFFFE5D9), Color(0xFFFFD4C4)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Center(
                          child: Icon(
                            Icons.image,
                            size: 60,
                            color: Colors.white70,
                          ),
                        ),
                      );
                    },
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Container(
                        height: 180,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(15),
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
            height: 180,
            viewportFraction: 1.0,
            autoPlay: false, // We're handling auto-play manually
            enlargeCenterPage: false,
            onPageChanged: (index, reason) {
              setState(() {
                _currentBannerIndex = index;
              });
            },
          ),
        ),
        const SizedBox(height: 8),
        // Page indicator dots
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            banners.length,
            (index) => Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.symmetric(horizontal: 4),
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
    );
  }

  // Resolve icon names coming from backend (e.g., "sports_soccer") to Material icons
  IconData _resolveIcon(String? iconNameOrCategoryName) {
    if (iconNameOrCategoryName == null || iconNameOrCategoryName.isEmpty) {
      return Icons.category;
    }
    final key = iconNameOrCategoryName
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

  // Helper function to parse color from hex string
  Color _parseColor(String? colorHex) {
    if (colorHex == null || colorHex.isEmpty) {
      return Colors.blue;
    }
    try {
      // Remove # if present and convert to int
      String hex = colorHex.replaceAll('#', '');
      if (hex.length == 6) {
        hex = 'FF$hex'; // Add alpha channel
      }
      return Color(int.parse(hex, radix: 16));
    } catch (e) {
      return Colors.blue;
    }
  }

  Widget _buildCategoryIcons() {
    // Get only parent categories (categories without parent)
    final parentCategories = _categoryService.parentCategories;

    // Convert API categories to UI format
    List<Map<String, dynamic>> categories = parentCategories
        .map<Map<String, dynamic>>((cat) {
          return {
            'logo': cat.logoUrl, // Use logo instead of icon
            'icon': _resolveIcon(cat.icon ?? cat.name),
            'label': cat.name,
            'color': _parseColor(cat.color),
            'category': cat, // Store the full category object for navigation
          };
        })
        .toList();

    // If no parent categories from API, show default categories (fallback)
    if (categories.isEmpty && !_categoryService.isLoading) {
      categories = [
        {
          'logo': null,
          'icon': Icons.wallet_outlined,
          'label': 'My Wallet',
          'color': Colors.orange,
        },
        {
          'logo': null,
          'icon': Icons.new_releases,
          'label': 'New Arrivals',
          'color': Colors.purple,
        },
        {
          'logo': null,
          'icon': Icons.sports_baseball,
          'label': 'Outdoor Sports',
          'color': Colors.green,
        },
      ];
    }

    const int itemsPerPage = 8; // 2 rows x 4 columns
    final int totalPages = (categories.length / itemsPerPage).ceil();

    return Column(
      children: [
        SizedBox(
          height:
              240, // Increased height to accommodate 2 rows with labels (70px icon + 6px spacing + ~40px text = ~116px per item, 2 rows + 16px spacing = ~248px needed)
          child: PageView.builder(
            controller: _categoryPageController,
            onPageChanged: (index) {
              setState(() {
                _currentCategoryPage = index;
              });
            },
            itemCount: totalPages,
            itemBuilder: (context, pageIndex) {
              final startIndex = pageIndex * itemsPerPage;
              final endIndex = (startIndex + itemsPerPage).clamp(
                0,
                categories.length,
              );
              final pageCategories = categories.sublist(startIndex, endIndex);

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // First row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        for (int i = 0; i < 4 && i < pageCategories.length; i++)
                          _buildCategoryItem(
                            logoUrl: pageCategories[i]['logo'] as String?,
                            icon: pageCategories[i]['icon'] as IconData,
                            label: pageCategories[i]['label'] as String,
                            color: pageCategories[i]['color'] as Color,
                            onTap: () {
                              setState(() {
                                _selectedIndex = 1; // Navigate to Category tab
                              });
                            },
                          ),
                        // Fill empty spaces if less than 4 items
                        for (int i = pageCategories.length; i < 4; i++)
                          const SizedBox(width: 65),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Second row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        for (int i = 4; i < 8 && i < pageCategories.length; i++)
                          _buildCategoryItem(
                            logoUrl: pageCategories[i]['logo'] as String?,
                            icon: pageCategories[i]['icon'] as IconData,
                            label: pageCategories[i]['label'] as String,
                            color: pageCategories[i]['color'] as Color,
                            onTap: () {
                              setState(() {
                                _selectedIndex = 1; // Navigate to Category tab
                              });
                            },
                          ),
                        // Fill empty spaces if less than 8 items
                        for (int i = pageCategories.length; i < 8; i++)
                          const SizedBox(width: 65),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        // Pagination dots for categories
        if (totalPages > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                totalPages,
                (index) => Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _currentCategoryPage == index
                        ? Colors.blue
                        : Colors.grey[300],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCategoryItem({
    required String label,
    required Color color,
    String? logoUrl,
    IconData? icon,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 65,
            height: 65,
            decoration: BoxDecoration(
              color: logoUrl != null ? Colors.white : color,
              shape: BoxShape.circle,
            ),
            child: logoUrl != null
                ? ClipOval(
                    child: Image.network(
                      ApiConfig.processImageUrl(logoUrl),
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        // Fallback to icon if logo fails to load
                        return Container(
                          color: color,
                          child: Icon(
                            icon ?? Icons.category,
                            color: Colors.white,
                            size: 30,
                          ),
                        );
                      },
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) return child;
                        return Container(
                          color: Colors.grey[200],
                          child: const Center(
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        );
                      },
                    ),
                  )
                : Icon(icon ?? Icons.category, color: Colors.white, size: 30),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: 75,
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 10,
                color: Colors.black87,
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductGrid() {
    final productService = ProductService();
    final products = productService.products
        .take(4)
        .toList(); // Show first 4 products

    if (products.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.75,
        ),
        itemCount: products.length,
        itemBuilder: (context, index) {
          final product = products[index];
          return _buildProductCard(
            product: product,
            name: product.name,
            price: product.formattedPrice,
            sold: '', // Sold count not available from API yet
            imageUrl: product.imageUrl,
          );
        },
      ),
    );
  }

  Widget _buildProductCard({
    Product? product,
    required String name,
    required String price,
    required String sold,
    required String imageUrl,
  }) {
    return GestureDetector(
      onTap: () {
        if (product != null) {
          // Navigate directly to product detail page
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProductDetailPage(product: product.toMap()),
            ),
          );
        }
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
            // Product image placeholder
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
                  child: Image.network(
                    ApiConfig.processImageUrl(imageUrl),
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      // Fallback to a simple icon if the image fails to load
                      return Center(
                        child: Icon(
                          Icons.image_not_supported_outlined,
                          size: 40,
                          color: Colors.grey[600],
                        ),
                      );
                    },
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Center(
                        child: CircularProgressIndicator(
                          value: loadingProgress.expectedTotalBytes != null
                              ? loadingProgress.cumulativeBytesLoaded /
                                    loadingProgress.expectedTotalBytes!
                              : null,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
            // Product info
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      price,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                    Text(
                      sold,
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
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

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, color: Colors.black87),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_selectedIndex == 1) {
      return const CategoriesPage();
    }

    if (_selectedIndex == 2) {
      return CartPage(
        onGoShopping: () {
          setState(() {
            _selectedIndex = 0;
          });
          _startCarouselTimer();
        },
      );
    }

    if (_selectedIndex == 3) {
      return const AccountPage();
    }

    // Home tab
    return Column(
      children: [
        _buildTopBar(),
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildPromoBanner(),
                const SizedBox(height: 8),
                _buildCategoryIcons(),
                _buildSectionHeader('Daily Offers'),
                _buildProductGrid(),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: SafeArea(top: true, bottom: false, child: _buildBody()),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Colors.grey[300]!, width: 0.8)),
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) {
            setState(() {
              _selectedIndex = index;
            });

            // Control the carousel timer based on the selected tab
            if (_selectedIndex == 0) {
              _startCarouselTimer();
            } else {
              _carouselTimer?.cancel();
            }
          },
          type: BottomNavigationBarType.fixed,
          selectedItemColor: AppTheme.primaryBlue,
          unselectedItemColor: Colors.grey,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home),
              label: 'Home',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.grid_view),
              label: 'Category',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.shopping_cart),
                  if (_cartService.itemCount > 0)
                    Positioned(
                      right: -8,
                      top: -8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Center(
                          child: Text(
                            '${_cartService.itemCount > 99 ? '99+' : _cartService.itemCount}',
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
              label: 'Cart',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}
