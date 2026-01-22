/// Utility functions for currency formatting
class CurrencyFormatter {
  /// Format a price value to currency string
  /// Example: 99.99 -> "$99.99"
  static String format(double price) {
    return '\$${price.toStringAsFixed(2)}';
  }

  /// Format a price value with currency symbol
  /// Example: 99.99 -> "99.99 USD"
  static String formatWithSymbol(double price, {String symbol = 'USD'}) {
    return '${price.toStringAsFixed(2)} $symbol';
  }
}
