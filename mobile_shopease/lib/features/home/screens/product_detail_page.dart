import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import '../../../config/api_config.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/services/wishlist_service.dart';
import '../../../core/services/product_service.dart';
import '../../../core/models/cart_item.dart';
import '../../../core/models/product.dart';
import '../../cart/screens/cart_page.dart';
import '../../cart/screens/checkout_page.dart';

class ProductDetailPage extends StatefulWidget {
  final Map<String, dynamic> product;

  const ProductDetailPage({super.key, required this.product});

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();

  // Helper to get Product from map
  static Product? getProductFromMap(Map<String, dynamic> productMap) {
    try {
      // Try to get product ID from map
      final productId = productMap['id'];
      if (productId != null) {
        final productService = ProductService();
        final id = productId is int
            ? productId
            : int.tryParse(productId.toString());
        if (id != null) {
          return productService.getProductById(id);
        }
      }
      // If not found, create Product from map
      return Product.fromJson(productMap);
    } catch (e) {
      return null;
    }
  }
}

class _ProductDetailPageState extends State<ProductDetailPage>
    with SingleTickerProviderStateMixin {
  int _quantity = 1;
  int _selectedImageIndex = 0;
  final ScrollController _scrollController = ScrollController();
  late AnimationController _imageAnimationController;
  final CartService _cartService = CartService();
  final WishlistService _wishlistService = WishlistService();
  Product? _product;

  // Get product from map or service
  Product get product {
    if (_product != null) return _product!;

    // Try to get from ProductService first
    final productId = widget.product['id'];
    if (productId != null) {
      final id = productId is int
          ? productId
          : int.tryParse(productId.toString());
      if (id != null) {
        final productService = ProductService();
        final foundProduct = productService.getProductById(id);
        if (foundProduct != null) {
          _product = foundProduct;
          return _product!;
        }
      }
    }

    // Fallback: create Product from map
    _product = Product.fromJson(widget.product);
    return _product!;
  }

  // Get product images - use all images from product, or fallback to single image
  List<String> get _productImages {
    if (product.images.isNotEmpty) {
      return product
          .imageUrls; // Use imageUrls getter which handles URL conversion
    }
    // Fallback to single image
    final imageUrl = widget.product['imageUrl'] as String? ?? product.imageUrl;
    return [imageUrl];
  }

  // Get product ID for cart/wishlist
  String get _productId {
    return product.id.toString();
  }

  bool get _isFavorite {
    return _wishlistService.isInWishlist(_productId);
  }

  @override
  void initState() {
    super.initState();
    _imageAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _imageAnimationController.forward();
    _cartService.addListener(_onCartChanged);
    _wishlistService.addListener(_onWishlistChanged);
  }

  @override
  void dispose() {
    _cartService.removeListener(_onCartChanged);
    _wishlistService.removeListener(_onWishlistChanged);
    _imageAnimationController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onCartChanged() {
    setState(() {});
  }

  void _onWishlistChanged() {
    setState(() {});
  }

  // Build product image widget (handles both network and asset images)
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
        fit: BoxFit.contain,
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
                size: 80,
                color: Colors.grey[400],
              ),
            ),
          );
        },
      );
    } else {
      // Asset image
      return Image.asset(
        imageUrl,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            color: Colors.grey[200],
            child: Center(
              child: Icon(
                Icons.sports_soccer,
                size: 80,
                color: Colors.grey[400],
              ),
            ),
          );
        },
      );
    }
  }

  Widget _buildAppBar() {
    return SafeArea(
      bottom: false,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              spreadRadius: 0,
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Back arrow with modern design
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => Navigator.of(context).pop(),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_back_ios_new,
                    size: 18,
                    color: Colors.black87,
                  ),
                ),
              ),
            ),
            // Title in center - Product name
            Expanded(
              child: Text(
                product.name,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                  letterSpacing: -0.3,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            // Heart and Share icons with modern design
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () async {
                      final cartItem = CartItem(
                        id: _productId,
                        name: product.name,
                        imageUrl: product.imageUrl,
                        price: product.formattedPrice,
                        quantity: 1,
                        color: product.color,
                        offer: product.offer,
                      );

                      await _wishlistService.toggleItem(_productId, cartItem);
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _isFavorite ? Icons.favorite : Icons.favorite_border,
                        size: 20,
                        color: _isFavorite ? Colors.red : Colors.black87,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImageGallery() {
    return GestureDetector(
      onTap: () {
        // Cycle through images when tapping main image
        setState(() {
          _selectedImageIndex =
              (_selectedImageIndex + 1) % _productImages.length;
          _imageAnimationController.reset();
          _imageAnimationController.forward();
        });
        // Scroll to the selected image below
        _scrollToSelectedImage();
      },
      child: Container(
        height: 420,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.grey[50]!, Colors.white],
          ),
        ),
        child: Stack(
          children: [
            // Animated image
            FadeTransition(
              opacity: _imageAnimationController,
              child: _buildProductImage(_productImages[_selectedImageIndex]),
            ),
            // Image dots indicator at bottom
            if (_productImages.length > 1)
              Positioned(
                bottom: 20,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    _productImages.length,
                    (index) => Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: index == _selectedImageIndex ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: index == _selectedImageIndex
                            ? AppTheme.primaryBlue
                            : Colors.grey[300],
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _scrollToSelectedImage() {
    if (_productImages.length <= 1) return;

    // Calculate position so selected image appears right below the main image
    // Main image: 400px, Product info: ~100px, spacing: 12px
    final double mainImageHeight = 400;
    final double productInfoHeight = 100;
    final double spacing = 12;
    final double imageHeight = 424; // 400 + 24 padding

    // Position = product info + main image + spacing + (selected index * image height)
    final double scrollPosition =
        productInfoHeight +
        mainImageHeight +
        spacing +
        (_selectedImageIndex * (imageHeight + spacing));

    // Scroll to show selected image right below main image
    _scrollController.animateTo(
      scrollPosition,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  Widget _buildProductInfo() {
    final currentPrice = product.formattedPrice;
    final stock = product.stock;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product name
          Text(
            product.name,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
              height: 1.3,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 20),
          // Price row
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                currentPrice,
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryBlue,
                  letterSpacing: -1,
                ),
              ),
              if (product.offer != null && product.offer!.isNotEmpty) ...[
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.accentOrange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    product.offer!,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.accentOrange,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
          // Stock information
          if (stock > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.check_circle, size: 16, color: Colors.green[600]),
                const SizedBox(width: 6),
                Text(
                  'In stock ($stock available)',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.green[700],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ] else if (stock == 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.cancel, size: 16, color: Colors.red[600]),
                const SizedBox(width: 6),
                Text(
                  'Out of stock',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.red[700],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 24),
          // Description section
          if (product.description != null && product.description!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Description',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.description!,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[700],
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            )
          else if (product.offer != null && product.offer!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Offer',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.offer!,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[700],
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSelectedItemBar() {
    final productName = product.name;
    final truncatedName = productName.length > 30
        ? '${productName.substring(0, 30)}...'
        : productName;

    return GestureDetector(
      onTap: () {
        _showSelectionModal();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.grey[50],
          border: Border(top: BorderSide(color: Colors.grey[200]!, width: 1)),
        ),
        child: SafeArea(
          top: false,
          child: Row(
            children: [
              // "Selected" label with badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryBlue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Selected',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primaryBlue,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Product name (truncated)
              Expanded(
                child: Text(
                  truncatedName,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[800],
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Quantity badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Text(
                  'X $_quantity',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Right arrow
              Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey[600]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAdditionalImages() {
    if (_productImages.length <= 1) return const SizedBox.shrink();

    // Only show additional images (skip index 0 which is the main image)
    final additionalImages = _productImages
        .asMap()
        .entries
        .where((entry) => entry.key > 0)
        .toList();

    return Column(
      children: additionalImages.map((entry) {
        final index = entry.key;
        final imageUrl = entry.value;
        final isSelected = _selectedImageIndex == index;
        return GestureDetector(
          onTap: () {
            setState(() {
              _selectedImageIndex = index;
              _imageAnimationController.reset();
              _imageAnimationController.forward();
            });
            // Scroll to show the selected image
            _scrollToSelectedImage();
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            margin: EdgeInsets.only(
              top: 16,
              bottom: entry == additionalImages.last ? 20 : 0,
            ),
            padding: EdgeInsets.all(isSelected ? 3 : 0),
            decoration: BoxDecoration(
              border: isSelected
                  ? Border.all(color: AppTheme.primaryBlue, width: 3)
                  : null,
              borderRadius: BorderRadius.circular(16),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: AppTheme.primaryBlue.withOpacity(0.2),
                        blurRadius: 12,
                        spreadRadius: 2,
                      ),
                    ]
                  : null,
            ),
            child: Container(
              height: 380,
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(13),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: _buildProductImage(imageUrl),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildBottomActionBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
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
        child: Row(
          children: [
            // Cart icon with badge
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => CartPage(
                        onGoShopping: () {
                          Navigator.pop(context);
                        },
                      ),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey[50],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(
                        Icons.shopping_cart_outlined,
                        size: 24,
                        color: Colors.grey[800],
                      ),
                      if (_cartService.itemCount > 0)
                        Positioned(
                          right: -4,
                          top: -4,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Colors.red[600]!, Colors.red[400]!],
                              ),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.red.withOpacity(0.5),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 20,
                              minHeight: 20,
                            ),
                            child: Center(
                              child: Text(
                                '${_cartService.itemCount}',
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
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Add to Cart button (yellow)
            Expanded(
              flex: 2,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () async {
                    // Check stock availability
                    if (product.stock > 0 && _quantity > product.stock) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(
                                  Icons.warning_amber_rounded,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Only ${product.stock} items available in stock',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            backgroundColor: Colors.orange,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            margin: const EdgeInsets.only(
                              top: 50,
                              left: 16,
                              right: 16,
                            ),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                      return;
                    }

                    if (product.stock == 0) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(
                                  Icons.cancel_outlined,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Text(
                                    'Product is out of stock',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            backgroundColor: Colors.red,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            margin: const EdgeInsets.only(
                              top: 50,
                              left: 16,
                              right: 16,
                            ),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                      return;
                    }

                    final cartItem = CartItem(
                      id: _productId,
                      name: product.name,
                      imageUrl: product.imageUrl,
                      price: product.formattedPrice,
                      quantity: _quantity,
                      color: product.color,
                      offer: product.offer,
                    );

                    await _cartService.addItem(cartItem);

                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Row(
                            children: [
                              const Icon(
                                Icons.check_circle,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Added $_quantity item(s) to cart',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          backgroundColor: AppTheme.primaryBlue,
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          margin: const EdgeInsets.only(
                            top: 50,
                            left: 16,
                            right: 16,
                          ),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    }
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppTheme.accentOrange,
                          AppTheme.accentOrange.withOpacity(0.8),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.accentOrange.withOpacity(0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'Add to Cart',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Buy Now button
            Expanded(
              flex: 2,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () async {
                    // Check stock availability
                    if (product.stock > 0 && _quantity > product.stock) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(
                                  Icons.warning_amber_rounded,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Only ${product.stock} items available in stock',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            backgroundColor: Colors.orange,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            margin: const EdgeInsets.only(
                              top: 50,
                              left: 16,
                              right: 16,
                            ),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                      return;
                    }

                    if (product.stock == 0) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(
                                  Icons.cancel_outlined,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Text(
                                    'Product is out of stock',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            backgroundColor: Colors.red,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            margin: const EdgeInsets.only(
                              top: 50,
                              left: 16,
                              right: 16,
                            ),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                      return;
                    }

                    // Add item to cart
                    final cartItem = CartItem(
                      id: _productId,
                      name: product.name,
                      imageUrl: product.imageUrl,
                      price: product.formattedPrice,
                      quantity: _quantity,
                      color: product.color,
                      offer: product.offer,
                    );

                    await _cartService.addItem(cartItem);

                    // Select the item for checkout
                    if (!_cartService.isItemSelected(_productId)) {
                      _cartService.toggleItemSelection(_productId);
                    }

                    // Navigate to checkout
                    if (mounted) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const CheckoutPage(),
                        ),
                      );
                    }
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppTheme.primaryBlue,
                          AppTheme.primaryBlue.withOpacity(0.8),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primaryBlue.withOpacity(0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'Buy Now',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSelectionModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black87,
      isDismissible: true,
      enableDrag: true,
      useSafeArea: true,
      builder: (context) => _buildSelectionModal(),
    );
  }

  Widget _buildSelectionModal() {
    final currentPrice = product.formattedPrice;
    final stockCount = product.stock;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Stack(
        children: [
          DraggableScrollableSheet(
            initialChildSize: 0.45,
            minChildSize: 0.35,
            maxChildSize: 0.65,
            builder: (context, scrollController) {
              return SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(height: 32), // Space for close button
                    // Product summary row - more compact
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Product thumbnail - smaller for half screen
                        Container(
                          width: 75,
                          height: 75,
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: _buildProductImage(product.imageUrl),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Price and product name
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Price
                              Text(
                                currentPrice,
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryBlue,
                                ),
                              ),
                              const SizedBox(height: 6),
                              // Product name
                              Text(
                                product.name,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Colors.black87,
                                  fontWeight: FontWeight.w500,
                                  height: 1.2,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Stock information and Quantity in a row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Stock information - left side
                        Text(
                          stockCount > 0
                              ? 'In stock ($stockCount available)'
                              : 'Out of stock',
                          style: TextStyle(
                            fontSize: 14,
                            color: stockCount > 0
                                ? Colors.green[700]
                                : Colors.red[700],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        // Quantity selector - right side
                        Row(
                          children: [
                            const Text(
                              'Quantity',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.grey[300]!),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    onPressed: _quantity > 1
                                        ? () {
                                            setState(() {
                                              _quantity--;
                                            });
                                          }
                                        : null,
                                    icon: Icon(
                                      Icons.remove,
                                      size: 18,
                                      color: _quantity > 1
                                          ? Colors.black87
                                          : Colors.grey[400],
                                    ),
                                    padding: const EdgeInsets.all(8),
                                    constraints: const BoxConstraints(
                                      minWidth: 36,
                                      minHeight: 36,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                    ),
                                    child: Text(
                                      '$_quantity',
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    onPressed:
                                        stockCount > 0 && _quantity < stockCount
                                        ? () {
                                            setState(() {
                                              _quantity++;
                                            });
                                          }
                                        : null,
                                    icon: Icon(
                                      Icons.add,
                                      size: 18,
                                      color:
                                          stockCount > 0 &&
                                              _quantity < stockCount
                                          ? Colors.black87
                                          : Colors.grey[400],
                                    ),
                                    padding: const EdgeInsets.all(8),
                                    constraints: const BoxConstraints(
                                      minWidth: 36,
                                      minHeight: 36,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Action buttons - side by side
                    Row(
                      children: [
                        // Add to cart button (left)
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () async {
                              // Check stock availability
                              if (product.stock > 0 &&
                                  _quantity > product.stock) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Row(
                                        children: [
                                          const Icon(
                                            Icons.warning_amber_rounded,
                                            color: Colors.white,
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              'Only ${product.stock} items available in stock',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      backgroundColor: Colors.orange,
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      margin: const EdgeInsets.only(
                                        top: 50,
                                        left: 16,
                                        right: 16,
                                      ),
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                }
                                return;
                              }

                              if (product.stock == 0) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Row(
                                        children: [
                                          const Icon(
                                            Icons.cancel_outlined,
                                            color: Colors.white,
                                          ),
                                          const SizedBox(width: 12),
                                          const Expanded(
                                            child: Text(
                                              'Product is out of stock',
                                              style: TextStyle(
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      backgroundColor: Colors.red,
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      margin: const EdgeInsets.only(
                                        top: 50,
                                        left: 16,
                                        right: 16,
                                      ),
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                }
                                return;
                              }

                              final cartItem = CartItem(
                                id: _productId,
                                name: product.name,
                                imageUrl: product.imageUrl,
                                price: product.formattedPrice,
                                quantity: _quantity,
                                color: product.color,
                                offer: product.offer,
                              );

                              await _cartService.addItem(cartItem);

                              if (!mounted) return;
                              final navigator = Navigator.of(context);
                              final messenger = ScaffoldMessenger.of(context);
                              navigator.pop();
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Row(
                                    children: [
                                      const Icon(
                                        Icons.check_circle,
                                        color: Colors.white,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          'Added $_quantity item(s) to cart',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  backgroundColor: AppTheme.primaryBlue,
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  margin: const EdgeInsets.only(
                                    top: 50,
                                    left: 16,
                                    right: 16,
                                  ),
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.accentOrange,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: const RoundedRectangleBorder(
                                borderRadius: BorderRadius.only(
                                  topLeft: Radius.circular(12),
                                  bottomLeft: Radius.circular(12),
                                  topRight: Radius.circular(0),
                                  bottomRight: Radius.circular(0),
                                ),
                              ),
                              elevation: 0,
                            ),
                            child: const Text(
                              'Add to cart',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                        // Buy Now button (right)
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () async {
                              // Check stock availability
                              if (product.stock > 0 &&
                                  _quantity > product.stock) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Only ${product.stock} items available in stock',
                                      ),
                                      backgroundColor: Colors.orange,
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                }
                                return;
                              }

                              if (product.stock == 0) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Product is out of stock'),
                                      backgroundColor: Colors.red,
                                      duration: Duration(seconds: 2),
                                    ),
                                  );
                                }
                                return;
                              }

                              // Add item to cart
                              final cartItem = CartItem(
                                id: _productId,
                                name: product.name,
                                imageUrl: product.imageUrl,
                                price: product.formattedPrice,
                                quantity: _quantity,
                                color: product.color,
                                offer: product.offer,
                              );

                              await _cartService.addItem(cartItem);

                              // Select the item for checkout
                              if (!_cartService.isItemSelected(_productId)) {
                                _cartService.toggleItemSelection(_productId);
                              }

                              // Close modal and navigate to checkout
                              if (mounted) {
                                Navigator.pop(context); // Close modal
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => const CheckoutPage(),
                                  ),
                                );
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryBlue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: const RoundedRectangleBorder(
                                borderRadius: BorderRadius.only(
                                  topLeft: Radius.circular(0),
                                  bottomLeft: Radius.circular(0),
                                  topRight: Radius.circular(12),
                                  bottomRight: Radius.circular(12),
                                ),
                              ),
                              elevation: 0,
                            ),
                            child: const Text(
                              'Buy Now',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(
                      height: MediaQuery.of(context).viewInsets.bottom + 8,
                    ),
                  ],
                ),
              );
            },
          ),
          // Drag handle
          Positioned(
            top: 12,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          // Close button (X) in top right
          Positioned(
            top: 8,
            right: 8,
            child: SafeArea(
              bottom: false,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => Navigator.pop(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 20,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          _buildAppBar(),
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              child: Column(
                children: [
                  _buildImageGallery(),
                  _buildProductInfo(),
                  _buildAdditionalImages(),
                ],
              ),
            ),
          ),
          _buildSelectedItemBar(),
          _buildBottomActionBar(),
        ],
      ),
    );
  }
}
