import 'package:flutter/material.dart';
import '../../../core/state/ui_state_mixin.dart';
import '../../../core/state/product_server_state.dart';
import '../../../core/models/product.dart';

/// Example: Products page with separated server and UI state
/// 
/// This demonstrates the proper separation of:
/// - Server State: Product data from API (ProductServerState)
/// - UI State: Tab selection, search query, filters (TabUIStateMixin, SearchFilterStateMixin)
class ProductsPageExample extends StatefulWidget {
  const ProductsPageExample({super.key});

  @override
  State<ProductsPageExample> createState() => _ProductsPageExampleState();
}

class _ProductsPageExampleState extends State<ProductsPageExample>
    with TabUIStateMixin, SearchFilterStateMixin {
  
  // ===== SERVER STATE =====
  final ProductServerState _productState = ProductServerState();
  
  // ===== UI STATE =====
  // Tab selection managed by TabUIStateMixin (selectedTabIndex, selectTab)
  // Search query managed by SearchFilterStateMixin (searchQuery, updateSearchQuery)
  // Filters managed by SearchFilterStateMixin (filters, setFilter)
  
  @override
  void initState() {
    super.initState();
    
    // Listen to server state changes
    _productState.addListener(_onServerStateChanged);
    
    // Load cached data first (instant UI)
    _productState.loadCache();
    
    // Then fetch fresh data from API
    _productState.fetch();
  }

  @override
  void dispose() {
    _productState.removeListener(_onServerStateChanged);
    super.dispose();
  }

  /// Called when server state changes (data fetched, loading state changed, etc.)
  void _onServerStateChanged() {
    if (mounted) setState(() {});
  }

  /// Get filtered products based on current UI state
  List<Product> get _filteredProducts {
    var products = _productState.products;
    
    // Apply category filter if selected
    final category = filters['category'] as String?;
    if (category != null) {
      products = _productState.getProductsByCategory(category);
    }
    
    // Apply search query
    if (searchQuery.isNotEmpty) {
      products = products.where((p) {
        return p.name.toLowerCase().contains(searchQuery.toLowerCase());
      }).toList();
    }
    
    return products;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _productState.fetch(forceRefresh: true),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar (UI state)
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search products...',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: updateSearchQuery, // Updates UI state
            ),
          ),
          
          // Category tabs (UI state)
          _buildCategoryTabs(),
          
          // Product list (Server state)
          Expanded(
            child: _buildProductList(),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    final categories = _productState.getCategories();
    
    return SizedBox(
      height: 50,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        itemBuilder: (context, index) {
          final category = categories[index];
          final isSelected = selectedTabIndex == index;
          
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(category),
              selected: isSelected,
              onSelected: (_) {
                selectTab(index); // Updates UI state
                setFilter('category', category == 'All' ? null : category);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildProductList() {
    // Handle server state: loading
    if (_productState.isInitialLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    
    // Handle server state: error with no cached data
    if (_productState.hasErrorNoData) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_productState.error ?? 'Unknown error'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _productState.fetch(forceRefresh: true),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    
    // Display filtered products
    final products = _filteredProducts;
    
    if (products.isEmpty) {
      return const Center(child: Text('No products found'));
    }
    
    return RefreshIndicator(
      onRefresh: () => _productState.fetch(forceRefresh: true),
      child: ListView.builder(
        itemCount: products.length,
        itemBuilder: (context, index) {
          final product = products[index];
          return ListTile(
            title: Text(product.name),
            subtitle: Text(product.description ?? ''),
            trailing: Text('\$${product.price}'),
          );
        },
      ),
    );
  }
}
