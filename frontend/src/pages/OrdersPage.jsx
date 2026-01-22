// src/OrdersPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

const STATUSES = ['pending', 'processing', 'delivered'];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const { data } = await api.get('/orders', { params });
      setOrders(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load orders');
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

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

  function getStatusColor(status) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
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

  async function updateOrderStatus(orderId, newStatus) {
    try {
      setUpdatingStatus(orderId);
      setError('');
      const { data } = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      
      // Update order in the list
      setOrders(orders.map(order => 
        order.id === orderId ? data : order
      ));
      
      // Update order details if it's currently open
      if (selectedOrder === orderId) {
        setOrderDetails(data);
      }
      
      console.log(`Order ${orderId} status updated to ${newStatus}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update order status');
      console.error('Error updating order status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em]">
            Orders
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Orders Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer orders and track their status
          </p>
        </div>

        {/* Filters */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Orders</option>
              {STATUSES.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              className="ml-auto inline-flex items-center rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition"
            >
              Refresh
            </button>
          </div>
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Orders List */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Orders List</h3>
              <p className="text-sm text-slate-500">
                {loading ? 'Loading...' : `${orders.length} order${orders.length !== 1 ? 's' : ''} found`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-sm text-slate-500 mt-4">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-sm">No orders found</p>
              {statusFilter && (
                <p className="text-xs mt-2">Try changing the status filter</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Order Number</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Items</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Total</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Payment</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900 font-medium">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>
                            <div className="font-medium">{order.customerName}</div>
                            <div className="text-xs text-slate-500">
                              {order.customerCity}, {order.customerDistrict}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {order.customerPhone}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{order.items?.length || 0}</span>
                            <span className="text-xs text-slate-500">item{order.items?.length !== 1 ? 's' : ''}</span>
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="text-xs text-slate-500 mt-1 max-w-xs truncate">
                              {order.items[0].productName}
                              {order.items.length > 1 && ` +${order.items.length - 1} more`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            disabled={updatingStatus === order.id}
                            className={`rounded-lg border-2 px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              order.status === 'pending' ? 'border-yellow-300 bg-yellow-50 text-yellow-700' :
                              order.status === 'processing' ? 'border-blue-300 bg-blue-50 text-blue-700' :
                              'border-emerald-300 bg-emerald-50 text-emerald-700'
                            } ${
                              updatingStatus === order.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'
                            }`}
                          >
                            {STATUSES.map(status => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                          {updatingStatus === order.id && (
                            <span className="ml-2 text-xs text-slate-500">Updating...</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-900 font-semibold">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-xs">
                          {formatDate(order.orderDate)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-xs">
                          {order.paymentMethod}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => viewOrderDetails(order.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {loadingDetails ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-sm text-slate-500 mt-4">Loading order details...</p>
              </div>
            ) : orderDetails ? (
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Order Details</h2>
                    <p className="text-sm text-slate-500 mt-1">Order #{orderDetails.orderNumber}</p>
                  </div>
                  <button
                    onClick={closeOrderDetails}
                    className="text-slate-400 hover:text-slate-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Information */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Customer Information</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-500">Name:</span>
                        <span className="ml-2 text-slate-900 font-medium">{orderDetails.customerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Phone:</span>
                        <span className="ml-2 text-slate-900">{orderDetails.customerPhone}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Address:</span>
                        <span className="ml-2 text-slate-900">{orderDetails.customerAddress}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">City:</span>
                        <span className="ml-2 text-slate-900">{orderDetails.customerCity}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">District:</span>
                        <span className="ml-2 text-slate-900">{orderDetails.customerDistrict}</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Information */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Order Information</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-500">Status:</span>
                        <div className="mt-2">
                          <select
                            value={orderDetails.status}
                            onChange={(e) => updateOrderStatus(orderDetails.id, e.target.value)}
                            disabled={updatingStatus === orderDetails.id}
                            className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              orderDetails.status === 'pending' ? 'border-yellow-300 bg-yellow-50 text-yellow-700' :
                              orderDetails.status === 'processing' ? 'border-blue-300 bg-blue-50 text-blue-700' :
                              'border-emerald-300 bg-emerald-50 text-emerald-700'
                            } ${
                              updatingStatus === orderDetails.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'
                            }`}
                          >
                            {STATUSES.map(status => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                          {updatingStatus === orderDetails.id && (
                            <span className="ml-2 text-xs text-slate-500">Updating...</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Date:</span>
                        <span className="ml-2 text-slate-900">{formatDate(orderDetails.orderDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Payment Method:</span>
                        <span className="ml-2 text-slate-900">{orderDetails.paymentMethod}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Subtotal:</span>
                        <span className="ml-2 text-slate-900">{formatCurrency(orderDetails.subtotal)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Shipping:</span>
                        <span className="ml-2 text-slate-900">{formatCurrency(orderDetails.shipping)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-slate-900 font-semibold">Total:</span>
                        <span className="ml-2 text-slate-900 font-bold text-lg">{formatCurrency(orderDetails.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Order Items</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Price</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {orderDetails.items && orderDetails.items.length > 0 ? (
                          orderDetails.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {item.productImage && (
                                    <img
                                      src={item.productImage}
                                      alt={item.productName}
                                      className="w-12 h-12 object-cover rounded border border-slate-200"
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-slate-900">{item.productName}</div>
                                    {item.color && (
                                      <div className="text-xs text-slate-500">Color: {item.color}</div>
                                    )}
                                    {item.offer && (
                                      <div className="text-xs text-slate-500">{item.offer}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{formatCurrency(item.price)}</td>
                              <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                              <td className="px-4 py-3 text-slate-900 font-medium">
                                {formatCurrency(Number(item.price) * item.quantity)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-3 text-center text-slate-500">
                              No items found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeOrderDetails}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-red-600">Failed to load order details</p>
                <button
                  onClick={closeOrderDetails}
                  className="mt-4 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

