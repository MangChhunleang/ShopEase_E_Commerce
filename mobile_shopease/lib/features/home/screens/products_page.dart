import 'package:flutter/material.dart';
import 'dart:async';
import '../../../theme/app_theme.dart';
import '../../../config/api_config.dart';
import '../screens/product_detail_page.dart';
import '../../../core/services/product_service.dart';
import '../../../core/services/search_service.dart';
import '../../../core/services/category_service.dart';
import '../../../core/models/product.dart';

class ProductsPage extends StatefulWidget {
  final String? categoryTitle;
  final String? searchQuery;

  const ProductsPage({super.key, this.categoryTitle, this.searchQuery});

  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  int _selectedCategoryIndex = 0;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  String _searchQuery = '';
  final ProductService _productService = ProductService();
  final SearchService _searchService = SearchService();
  final CategoryService _categoryService = CategoryService();

  List<String> _categories = ['All'];
  List<Product> _searchResults = [];
  bool _isSearching = false;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _searchController.text = widget.searchQuery ?? '';
    _searchQuery = widget.searchQuery ?? '';

    _searchController.addListener(_onSearchChanged);
    _searchFocusNode.addListener(_onFocusChanged);

    _productService.addListener(_onProductsChanged);
    _searchService.addListener(_onSearchServiceChanged);
    _categoryService.addListener(_onCategoriesChanged);

    _loadData();
    _searchService.loadSearchHistory();

    if (widget.categoryTitle != null && widget.categoryTitle!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _selectCategoryByName(widget.categoryTitle!);
      });
    }
  }

  void _onSearchChanged() {
    final query = _searchController.text;
    setState(() {
      _searchQuery = query;
    });

    // Cancel any pending debounce
    _debounceTimer?.cancel();
  }

  void _onFocusChanged() {
    // Focus handling without suggestions
  }

  void _onProductsChanged() {
    if (mounted) {
      setState(() {
        _categories = _productService.getCategories();
      });
    }
  }

  void _onSearchServiceChanged() {
    if (mounted) setState(() {});
  }

  void _onCategoriesChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadData() async {
    await _productService.loadCachedProducts();
    await _categoryService.loadCachedCategories();
    if (mounted) {
      setState(() {
        _categories = _productService.getCategories();
      });
    }
    await _productService.fetchProducts();
    await _categoryService.fetchCategories();
  }

  Future<void> _performSearch() async {
    if (_searchQuery.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }

    setState(() {
      _isSearching = true;
    });

    // Save to search history
    await _searchService.addToHistory(_searchQuery.trim());

    // Get selected category
    String? category;
    if (widget.categoryTitle != null && widget.categoryTitle!.isNotEmpty) {
      category = widget.categoryTitle;
    } else if (_selectedCategoryIndex > 0 &&
        _categories.length > _selectedCategoryIndex) {
      final selectedCategory = _categories[_selectedCategoryIndex];
      if (selectedCategory != 'All') {
        category = selectedCategory;
      }
    }

    // Perform backend search
    final results = await _searchService.searchProducts(
      query: _searchQuery.trim(),
      category: category,
    );

    if (mounted) {
      setState(() {
        _searchResults = results;
        _isSearching = false;
      });
    }
  }

  void _selectCategoryByName(String categoryName) {
    if (_categories.isEmpty) {
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) _selectCategoryByName(categoryName);
      });
      return;
    }

    final index = _categories.indexWhere(
      (cat) => cat.toLowerCase() == categoryName.toLowerCase(),
    );
    if (index >= 0 && mounted) {
      setState(() {
        _selectedCategoryIndex = index;
      });
      _performSearch();
    }
  }

  List<Product> get _displayedProducts {
    // Show products if:
    // 1. User has searched for something, OR
    // 2. A category is selected (from navigation or category filter)

    // Check if we have a category context
    final hasCategory =
        widget.categoryTitle != null && widget.categoryTitle!.isNotEmpty;
    final hasCategoryFilter = _selectedCategoryIndex > 0;

    // Only show products if user searched OR if there's a category filter
    if (_searchQuery.trim().isEmpty && !hasCategory && !hasCategoryFilter) {
      return [];
    }

    // If user typed a query, show search results
    if (_searchQuery.trim().isNotEmpty) {
      if (_searchResults.isNotEmpty) {
        return _searchResults;
      }

      var products = _productService.products;
      final lowerQuery = _searchQuery.toLowerCase();
      products = products.where((p) {
        return p.name.toLowerCase().contains(lowerQuery) ||
            (p.description?.toLowerCase().contains(lowerQuery) ?? false);
      }).toList();

      return products;
    }

    // Show products filtered by category
    var products = _productService.products;

    String? categoryToFilter;
    if (hasCategory) {
      categoryToFilter = widget.categoryTitle;
    } else if (hasCategoryFilter &&
        _categories.length > _selectedCategoryIndex) {
      final selectedCategory = _categories[_selectedCategoryIndex];
      if (selectedCategory != 'All') {
        categoryToFilter = selectedCategory;
      }
    }

    if (categoryToFilter != null && categoryToFilter != 'All') {
      products = _productService.getProductsByCategory(categoryToFilter);
    }

    return products;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _productService.removeListener(_onProductsChanged);
    _searchService.removeListener(_onSearchServiceChanged);
    _categoryService.removeListener(_onCategoriesChanged);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
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
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Stack(
              children: [
                Container(
                  height: 35,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(color: AppTheme.primaryBlue, width: 1.2),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 12),
                      Icon(Icons.search, color: Colors.grey[600], size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          focusNode: _searchFocusNode,
                          decoration: InputDecoration(
                            hintText:
                                widget.categoryTitle ?? 'Search for products',
                            hintStyle: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 14,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                          style: const TextStyle(fontSize: 14),
                          onSubmitted: (_) {
                            _searchFocusNode.unfocus();
                            _performSearch();
                          },
                        ),
                      ),
                      if (_searchQuery.isNotEmpty)
                        IconButton(
                          icon: Icon(
                            Icons.clear,
                            size: 18,
                            color: Colors.grey[600],
                          ),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                              _searchResults = [];
                            });
                            _searchFocusNode.unfocus();
                          },
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryFilters() {
    if (_categories.length <= 1) {
      return const SizedBox.shrink();
    }

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final isSelected = index == _selectedCategoryIndex;
          return GestureDetector(
            onTap: () {
              setState(() {
                _selectedCategoryIndex = index;
              });
              _performSearch();
            },
            child: Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _categories[index],
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isSelected
                          ? AppTheme.primaryBlue
                          : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (isSelected)
                    Container(
                      height: 2,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: AppTheme.accentOrange,
                        borderRadius: BorderRadius.circular(1),
                      ),
                    )
                  else
                    const SizedBox(height: 2),
                ],
              ),
            ),
          );
        },
      ),
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
                    ApiConfig.processImageUrl(product.imageUrl),
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
                            Icons.image,
                            size: 40,
                            color: Colors.grey[400],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _highlightSearchTerm(product.name),
                    if (product.offer != null && product.offer!.isNotEmpty)
                      Text(
                        product.offer!,
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.accentOrange,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    Text(
                      product.formattedPrice,
                      style: TextStyle(
                        fontSize: 16,
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

  Widget _highlightSearchTerm(String text) {
    if (_searchQuery.trim().isEmpty) {
      return Text(
        text,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.black87,
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      );
    }

    final lowerText = text.toLowerCase();
    final lowerQuery = _searchQuery.toLowerCase();
    final index = lowerText.indexOf(lowerQuery);

    if (index == -1) {
      return Text(
        text,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.black87,
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      );
    }

    return RichText(
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.black87,
        ),
        children: [
          TextSpan(text: text.substring(0, index)),
          TextSpan(
            text: text.substring(index, index + _searchQuery.length),
            style: TextStyle(
              backgroundColor: AppTheme.accentOrange.withOpacity(0.3),
              fontWeight: FontWeight.bold,
            ),
          ),
          TextSpan(text: text.substring(index + _searchQuery.length)),
        ],
      ),
    );
  }

  Widget _buildProductGrid() {
    if (_isSearching) {
      return const Expanded(child: Center(child: CircularProgressIndicator()));
    }

    final products = _displayedProducts;

    if (products.isEmpty) {
      // Show different message if no search query vs no results
      final hasSearchQuery = _searchQuery.trim().isNotEmpty;

      return Expanded(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                hasSearchQuery ? Icons.search_off : Icons.search,
                size: 64,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 16),
              Text(
                hasSearchQuery ? 'No products found' : 'Start searching',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                hasSearchQuery
                    ? 'Try adjusting your search or filters'
                    : 'No products in this category yet',
                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
      );
    }

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: GridView.builder(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.75,
          ),
          itemCount: products.length,
          itemBuilder: (context, index) {
            return _buildProductCard(products[index]);
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildCategoryFilters(),
            _buildProductGrid(),
          ],
        ),
      ),
    );
  }
}
