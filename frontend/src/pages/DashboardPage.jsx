// src/DashboardPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    pendingOrders: 0,
    processingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    expiredOrders: 0,
    failedOrders: 0,
    recentOrders: 0,
    recentRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
    loadRecentOrders();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setError('');
      
      // Fetch dashboard statistics
      const statsRes = await api.get('/stats');
      const data = statsRes.data;
      
      setStats({
        totalProducts: data.totalProducts || 0,
        totalOrders: data.totalOrders || 0,
        totalRevenue: data.totalRevenue || 0,
        totalUsers: data.totalUsers || 0,
        pendingOrders: data.pendingOrders || 0,
        processingOrders: data.processingOrders || 0,
        deliveredOrders: data.deliveredOrders || 0,
        cancelledOrders: data.cancelledOrders || 0,
        expiredOrders: data.expiredOrders || 0,
        failedOrders: data.failedOrders || 0,
        recentOrders: 0,
        recentRevenue: 0,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load statistics');
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentOrders() {
    try {
      // Fetch recent orders (last 5)
      const { data } = await api.get('/orders', { params: { limit: 5 } });
      setRecentOrders(data.slice(0, 5)); // Limit to 5 most recent
    } catch (err) {
      console.error('Error loading recent orders:', err);
      // Don't show error for recent orders, just log it
    }
  }

  function formatCurrency(amount) {
    if (typeof amount === 'string') {
      return `$${parseFloat(amount).toFixed(2)}`;
    }
    return `$${Number(amount).toFixed(2)}`;
  }

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
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'expired':
        return 'bg-orange-100 text-orange-700';
      case 'failed':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  const statCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts,
      icon: '📦',
      color: 'bg-blue-500',
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders,
      icon: '🛒',
      color: 'bg-green-500',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: '💰',
      color: 'bg-emerald-500',
    },
    {
      label: 'Pending Orders',
      value: stats.pendingOrders,
      icon: '⏳',
      color: 'bg-amber-500',
    },
    {
      label: 'Delivered Orders',
      value: stats.deliveredOrders,
      icon: '✓',
      color: 'bg-teal-500',
    },
    {
      label: 'Cancelled Orders',
      value: stats.cancelledOrders,
      icon: '✕',
      color: 'bg-red-500',
      link: '/cancelled-orders',
    },
    {
      label: 'Expired Orders',
      value: stats.expiredOrders,
      icon: '⏱️',
      color: 'bg-orange-500',
    },
    {
      label: 'Failed Orders',
      value: stats.failedOrders,
      icon: '⚠️',
      color: 'bg-rose-500',
    },
    {
      label: 'Recent Orders (7d)',
      value: stats.recentOrders,
      icon: '📊',
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em]">
            Dashboard
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome to your admin dashboard
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className={`bg-white border border-slate-200 rounded-xl shadow-sm p-6 ${stat.link ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition' : ''}`}
              onClick={() => {
                if (stat.link) {
                  window.location.href = stat.link;
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    {stat.label}
                  </p>
                  {loading ? (
                    <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-2xl font-semibold text-slate-900">
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                  {stat.icon}
                </div>
              </div>
              {stat.link && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">View details →</p>
              )}
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Orders
            </h2>
            <a
              href="/orders"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View All →
            </a>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-sm">No recent orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Order Number</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {recentOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900 font-medium">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {order.customerName}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        {formatDate(order.orderDate || order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


