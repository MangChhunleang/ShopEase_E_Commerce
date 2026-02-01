// src/pages/CancelledOrdersPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function CancelledOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const limit = 10;

  async function loadOrders(pageNum) {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/admin/orders/cancelled', {
        params: { page: pageNum, limit }
      });
      setOrders(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
      setPage(pageNum);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load cancelled orders');
      console.error('Error loading cancelled orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(1);
  }, []);

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  }

  function formatCurrency(amount) {
    if (typeof amount === 'string') {
      return `$${parseFloat(amount).toFixed(2)}`;
    }
    return `$${Number(amount).toFixed(2)}`;
  }

  async function viewOrderDetails(orderId) {
    try {
      setLoadingDetails(true);
      setError('');
      const { data } = await api.get(`/orders/${orderId}`);
      setOrderDetails(data);
      setSelectedOrder(orderId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load order details');
      console.error('Error loading order details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }

  function closeOrderDetails() {
    setSelectedOrder(null);
    setOrderDetails(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <a href="/" className="text-sm text-indigo-600 hover:text-indigo-800">
              Dashboard
            </a>
            <span className="text-slate-400">/</span>
            <span className="text-sm font-medium text-slate-900">Cancelled Orders</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-4">
            Cancelled Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View all orders that were cancelled due to payment timeout
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <div className="animate-pulse">Loading cancelled orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-4">✓</div>
              <p className="text-sm">No cancelled orders</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-6 py-3 text-left">Order Number</th>
                      <th className="px-6 py-3 text-left">Customer</th>
                      <th className="px-6 py-3 text-left">Reason</th>
                      <th className="px-6 py-3 text-left">Items</th>
                      <th className="px-6 py-3 text-left">Amount</th>
                      <th className="px-6 py-3 text-left">Cancelled Date</th>
                      <th className="px-6 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900 font-medium">
                          {order.orderNumber}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {order.customerName}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          <div className="max-w-xs truncate text-xs">
                            {order.cancellationReason}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-900">
                          {order.itemCount || 0} items
                        </td>
                        <td className="px-6 py-4 text-slate-900 font-semibold">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-6 py-4 text-slate-700 text-xs">
                          {formatDate(order.cancelledAt)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => viewOrderDetails(order.id)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                  <div className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadOrders(page - 1)}
                      disabled={page === 1}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => loadOrders(page + 1)}
                      disabled={page >= totalPages}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && orderDetails && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Order Details: {orderDetails.orderNumber}
                </h2>
                <button
                  onClick={closeOrderDetails}
                  className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="animate-pulse">Loading order details...</div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Order Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Order Number</p>
                      <p className="text-sm text-slate-900 font-medium mt-1">{orderDetails.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Status</p>
                      <p className="text-sm text-red-700 font-medium mt-1">Cancelled</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Created Date</p>
                      <p className="text-sm text-slate-900 mt-1">{formatDate(orderDetails.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Payment Method</p>
                      <p className="text-sm text-slate-900 mt-1">{orderDetails.paymentMethod}</p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Name</p>
                        <p className="text-slate-900 font-medium">{orderDetails.customerName}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Phone</p>
                        <p className="text-slate-900 font-medium">{orderDetails.customerPhone}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-600">Address</p>
                        <p className="text-slate-900 font-medium">
                          {orderDetails.customerAddress}, {orderDetails.customerDistrict}, {orderDetails.customerCity}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Items</h3>
                    <div className="space-y-2">
                      {orderDetails.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b border-slate-200 pb-2">
                          <div>
                            <p className="text-slate-900 font-medium">{item.productName}</p>
                            <p className="text-slate-600 text-xs">Qty: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-900 font-medium">{formatCurrency(item.price)}</p>
                            <p className="text-slate-600 text-xs">{formatCurrency(item.price * item.quantity)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <p className="text-slate-600">Subtotal</p>
                      <p className="text-slate-900 font-medium">{formatCurrency(orderDetails.subtotal)}</p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <p className="text-slate-600">Shipping</p>
                      <p className="text-slate-900 font-medium">{formatCurrency(orderDetails.shipping)}</p>
                    </div>
                    <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                      <p className="text-slate-900 font-semibold">Total</p>
                      <p className="text-slate-900 font-semibold">{formatCurrency(orderDetails.total)}</p>
                    </div>
                  </div>

                  {/* Status History */}
                  {orderDetails.statusHistory && orderDetails.statusHistory.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Order History</h3>
                      <div className="space-y-2">
                        {orderDetails.statusHistory.map((history, idx) => (
                          <div key={idx} className="text-xs border-l-2 border-slate-300 pl-3 py-1">
                            <p className="text-slate-900 font-medium">{history.status.toUpperCase()}</p>
                            <p className="text-slate-600">{history.note}</p>
                            <p className="text-slate-500">{formatDate(history.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
