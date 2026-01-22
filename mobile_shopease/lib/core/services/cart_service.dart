import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cart_item.dart';

class CartService extends ChangeNotifier {
  static final CartService _instance = CartService._internal();
  factory CartService() => _instance;
  CartService._internal();

  List<CartItem> _items = [];
  Set<String> _selectedItems = {};
  static const String _cartKey = 'cart_items';
  static const String _selectedKey = 'selected_items';

  List<CartItem> get items => List.unmodifiable(_items);
  
  Set<String> get selectedItems => Set.unmodifiable(_selectedItems);
  
  List<CartItem> get selectedItemsList => 
      _items.where((item) => _selectedItems.contains(item.id)).toList();

  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);

  double get totalPrice => _items.fold(0.0, (sum, item) => sum + item.totalPrice);
  
  double get selectedTotalPrice => 
      _items.where((item) => _selectedItems.contains(item.id))
          .fold(0.0, (sum, item) => sum + item.totalPrice);

  bool get isEmpty => _items.isEmpty;
  
  bool get isAllSelected => _items.isNotEmpty && _selectedItems.length == _items.length;
  
  bool isItemSelected(String itemId) => _selectedItems.contains(itemId);

  Future<void> loadCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = prefs.getString(_cartKey);
      if (cartJson != null) {
        final List<dynamic> decoded = json.decode(cartJson);
        _items = decoded.map((item) => CartItem.fromJson(item)).toList();
      }
      
      // Load selected items
      final selectedJson = prefs.getString(_selectedKey);
      if (selectedJson != null) {
        final List<dynamic> decoded = json.decode(selectedJson);
        _selectedItems = decoded.map((id) => id as String).toSet();
        // Remove selections for items that no longer exist
        _selectedItems.removeWhere((id) => !_items.any((item) => item.id == id));
      } else {
        // If no saved selection, select all items by default
        _selectedItems = _items.map((item) => item.id).toSet();
      }
      
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading cart: $e');
    }
  }

  Future<void> _saveCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = json.encode(_items.map((item) => item.toJson()).toList());
      await prefs.setString(_cartKey, cartJson);
    } catch (e) {
      debugPrint('Error saving cart: $e');
    }
  }
  
  Future<void> _saveSelectedItems() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final selectedJson = json.encode(_selectedItems.toList());
      await prefs.setString(_selectedKey, selectedJson);
    } catch (e) {
      debugPrint('Error saving selected items: $e');
    }
  }

  Future<void> addItem(CartItem item) async {
    final existingIndex = _items.indexWhere((i) => i.id == item.id);
    
    if (existingIndex >= 0) {
      // Item exists, update quantity
      _items[existingIndex] = _items[existingIndex].copyWith(
        quantity: _items[existingIndex].quantity + item.quantity,
      );
    } else {
      // New item, add to cart
      _items.add(item);
    }
    
    notifyListeners();
    await _saveCart();
  }

  Future<void> removeItem(String itemId) async {
    _items.removeWhere((item) => item.id == itemId);
    _selectedItems.remove(itemId);
    notifyListeners();
    await _saveCart();
    await _saveSelectedItems();
  }

  Future<void> updateQuantity(String itemId, int quantity) async {
    if (quantity <= 0) {
      await removeItem(itemId);
      return;
    }

    final index = _items.indexWhere((item) => item.id == itemId);
    if (index >= 0) {
      _items[index] = _items[index].copyWith(quantity: quantity);
      notifyListeners();
      await _saveCart();
    }
  }

  Future<void> clearCart() async {
    _items.clear();
    notifyListeners();
    await _saveCart();
  }

  bool isInCart(String itemId) {
    return _items.any((item) => item.id == itemId);
  }
  
  Future<void> toggleItemSelection(String itemId) async {
    if (_selectedItems.contains(itemId)) {
      _selectedItems.remove(itemId);
    } else {
      _selectedItems.add(itemId);
    }
    notifyListeners();
    await _saveSelectedItems();
  }
  
  Future<void> selectAll() async {
    _selectedItems = _items.map((item) => item.id).toSet();
    notifyListeners();
    await _saveSelectedItems();
  }
  
  Future<void> deselectAll() async {
    _selectedItems.clear();
    notifyListeners();
    await _saveSelectedItems();
  }
  
  Future<void> toggleSelectAll() async {
    if (isAllSelected) {
      await deselectAll();
    } else {
      await selectAll();
    }
  }
}

