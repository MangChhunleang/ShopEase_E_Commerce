import 'package:flutter/material.dart';

/// Mixin for managing common UI state patterns in StatefulWidgets
/// 
/// UI state represents transient presentation concerns that:
/// - Don't persist across app sessions
/// - Are local to a single screen/widget
/// - Control visual presentation only
/// 
/// Examples: Tab selection, page index, form inputs, dialog visibility
mixin UIStateMixin<T extends StatefulWidget> on State<T> {
  // UI state fields should be declared in the State class itself
  
  /// Safe setState that checks if widget is still mounted
  void safeSetState(VoidCallback fn) {
    if (mounted) {
      setState(fn);
    }
  }

  /// Update state only if the new value is different
  void setStateIfChanged<V>(V currentValue, V newValue, VoidCallback fn) {
    if (currentValue != newValue) {
      setState(fn);
    }
  }
}

/// Mixin for managing tab-based UI state
mixin TabUIStateMixin<T extends StatefulWidget> on State<T> {
  int _selectedTabIndex = 0;

  int get selectedTabIndex => _selectedTabIndex;

  void selectTab(int index) {
    if (index != _selectedTabIndex && mounted) {
      setState(() {
        _selectedTabIndex = index;
      });
    }
  }

  void resetTab() {
    selectTab(0);
  }
}

/// Mixin for managing pagination UI state
mixin PaginationUIStateMixin<T extends StatefulWidget> on State<T> {
  int _currentPage = 0;
  final PageController _pageController = PageController();

  int get currentPage => _currentPage;
  PageController get pageController => _pageController;

  void goToPage(int page) {
    if (page != _currentPage && mounted) {
      setState(() {
        _currentPage = page;
      });
      _pageController.animateToPage(
        page,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void nextPage() {
    goToPage(_currentPage + 1);
  }

  void previousPage() {
    if (_currentPage > 0) {
      goToPage(_currentPage - 1);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

/// Mixin for managing form UI state
mixin FormUIStateMixin<T extends StatefulWidget> on State<T> {
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, String?> _errors = {};
  bool _isFormValid = false;

  bool get isFormValid => _isFormValid;

  TextEditingController getController(String fieldName) {
    return _controllers.putIfAbsent(
      fieldName,
      () => TextEditingController(),
    );
  }

  String? getError(String fieldName) => _errors[fieldName];

  void setError(String fieldName, String? error) {
    if (mounted) {
      setState(() {
        _errors[fieldName] = error;
        _validateForm();
      });
    }
  }

  void clearErrors() {
    if (mounted) {
      setState(() {
        _errors.clear();
        _validateForm();
      });
    }
  }

  void _validateForm() {
    _isFormValid = _errors.values.every((error) => error == null);
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
    super.dispose();
  }
}

/// Mixin for managing loading button state
mixin LoadingButtonStateMixin<T extends StatefulWidget> on State<T> {
  final Map<String, bool> _loadingButtons = {};

  bool isButtonLoading(String buttonId) => _loadingButtons[buttonId] ?? false;

  void setButtonLoading(String buttonId, bool loading) {
    if (mounted) {
      setState(() {
        _loadingButtons[buttonId] = loading;
      });
    }
  }

  /// Execute async action with button loading state
  Future<void> withButtonLoading(
    String buttonId,
    Future<void> Function() action,
  ) async {
    setButtonLoading(buttonId, true);
    try {
      await action();
    } finally {
      setButtonLoading(buttonId, false);
    }
  }
}

/// Mixin for managing dialog/modal visibility state
mixin DialogStateMixin<T extends StatefulWidget> on State<T> {
  final Set<String> _visibleDialogs = {};

  bool isDialogVisible(String dialogId) => _visibleDialogs.contains(dialogId);

  void showDialog(String dialogId) {
    if (mounted) {
      setState(() {
        _visibleDialogs.add(dialogId);
      });
    }
  }

  void hideDialog(String dialogId) {
    if (mounted) {
      setState(() {
        _visibleDialogs.remove(dialogId);
      });
    }
  }

  void hideAllDialogs() {
    if (mounted) {
      setState(() {
        _visibleDialogs.clear();
      });
    }
  }
}

/// Mixin for managing search/filter UI state
mixin SearchFilterStateMixin<T extends StatefulWidget> on State<T> {
  String _searchQuery = '';
  final Map<String, dynamic> _filters = {};

  String get searchQuery => _searchQuery;
  Map<String, dynamic> get filters => Map.unmodifiable(_filters);

  void updateSearchQuery(String query) {
    if (query != _searchQuery && mounted) {
      setState(() {
        _searchQuery = query;
      });
    }
  }

  void setFilter(String key, dynamic value) {
    if (mounted) {
      setState(() {
        _filters[key] = value;
      });
    }
  }

  void clearFilter(String key) {
    if (mounted) {
      setState(() {
        _filters.remove(key);
      });
    }
  }

  void clearAllFilters() {
    if (mounted) {
      setState(() {
        _filters.clear();
        _searchQuery = '';
      });
    }
  }
}
