# State Management Architecture

## Overview

This project uses a **two-tier state management** approach that separates server state from UI state:

### 1. Server State (Data Layer)
**Location:** `lib/core/services/`

Services that manage data fetched from the API:
- **Purpose:** Fetch, cache, and sync data from the backend
- **Extends:** `ChangeNotifier` for reactive updates
- **Pattern:** Singleton instances
- **Persistence:** SharedPreferences for offline caching
- **Examples:**
  - `ProductService` - Product catalog data
  - `OrderService` - Order history and details
  - `CategoryService` - Category listings
  - `BannerService` - Banner/carousel data
  - `AuthService` - User authentication state

**Characteristics:**
- Contains `isLoading` and `error` fields for async operations
- Implements caching with expiry logic
- Calls `notifyListeners()` when data changes
- Provides read-only access via getters
- Handles API communication

### 2. UI State (Presentation Layer)
**Location:** Widget `State` classes (typically in screens/pages)

Local state that controls UI behavior:
- **Purpose:** Manage transient UI concerns
- **Pattern:** `StatefulWidget` with `setState()`
- **Scope:** Widget-local (not shared)
- **Examples:**
  - Selected tab index
  - Current carousel page
  - Form input values
  - Scroll positions
  - Expansion panel states
  - Dialog visibility
  - Local loading indicators (e.g., button loading)

**Characteristics:**
- Lives in `State<T>` classes
- Updated via `setState()`
- Not persisted (lost on widget disposal)
- Scoped to single widget tree
- Resets on screen navigation

## Usage Pattern

### Server State
```dart
// In screen widget
class ProductsPage extends StatefulWidget {
  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  final ProductService _productService = ProductService(); // Server state
  
  @override
  void initState() {
    super.initState();
    // Listen to server state changes
    _productService.addListener(_onProductsChanged);
    // Fetch data
    _productService.fetchProducts();
  }
  
  @override
  void dispose() {
    _productService.removeListener(_onProductsChanged);
    super.dispose();
  }
  
  void _onProductsChanged() {
    if (mounted) setState(() {}); // Trigger rebuild when server data changes
  }
  
  @override
  Widget build(BuildContext context) {
    // Access server state
    final products = _productService.products;
    final isLoading = _productService.isLoading;
    
    if (isLoading) return CircularProgressIndicator();
    return ListView.builder(...);
  }
}
```

### UI State
```dart
class _ProductsPageState extends State<ProductsPage> {
  // UI state - local to this widget
  int _selectedTab = 0;
  String _searchQuery = '';
  bool _isFilterExpanded = false;
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Use UI state
        TabBar(
          onTap: (index) => setState(() => _selectedTab = index),
          // ...
        ),
        TextField(
          onChanged: (value) => setState(() => _searchQuery = value),
        ),
        ExpansionTile(
          initiallyExpanded: _isFilterExpanded,
          onExpansionChanged: (expanded) => 
            setState(() => _isFilterExpanded = expanded),
        ),
      ],
    );
  }
}
```

## State Flow

```
┌─────────────────────────────────────────────────┐
│              User Interaction                   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │    UI State Change   │ ← setState() for local UI
        │  (tab, form, etc.)   │
        └──────────────────────┘
                   │
                   ▼ (may trigger)
        ┌──────────────────────┐
        │  Service Method Call │ ← Fetch/modify server data
        │ (fetchProducts, etc) │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   API Request        │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Server State Update │ ← notifyListeners()
        │  (products, orders)  │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Widget Rebuilds     │ ← setState() in listener
        │  (UI reflects data)  │
        └──────────────────────┘
```

## Benefits

✅ **Clear Separation of Concerns:** Server data vs UI presentation
✅ **Single Source of Truth:** Services are singletons
✅ **Offline Support:** Server state cached in SharedPreferences
✅ **Reactive Updates:** ChangeNotifier pattern for data changes
✅ **Minimal Boilerplate:** No Provider/Riverpod setup needed
✅ **Testable:** Services can be tested independently
✅ **Performance:** UI state doesn't trigger service listeners

## Migration Guide

When refactoring, ask yourself:

**Is this state fetched from the API?**
- ✅ Yes → Server State (Service)
- ❌ No → UI State (setState)

**Does this state need to persist across sessions?**
- ✅ Yes → Server State with SharedPreferences
- ❌ No → UI State

**Is this state shared across multiple screens?**
- ✅ Yes → Server State (singleton Service)
- ❌ No → UI State (local to widget)

**Examples:**
- ✅ Server: Product list, user profile, cart items, orders
- ❌ UI: Selected tab, current page index, text field content, loading spinner
