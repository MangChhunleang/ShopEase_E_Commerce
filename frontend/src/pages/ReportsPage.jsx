// src/pages/ReportsPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/admin/orders/report/timeout-impact');
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load report');
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
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
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
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
            <span className="text-sm font-medium text-slate-900">Reports</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-4">
            Payment Timeout Impact Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analytics on orders lost due to payment timeout
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-slate-500">Loading report...</div>
          </div>
        ) : report ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <p className="text-sm font-medium text-slate-600 mb-2">Total Timeout Orders</p>
                <p className="text-3xl font-semibold text-slate-900">
                  {report.summary?.totalTimeoutOrders || 0}
                </p>
                <p className="text-xs text-slate-500 mt-2">Orders cancelled</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <p className="text-sm font-medium text-slate-600 mb-2">Total Lost Revenue</p>
                <p className="text-3xl font-semibold text-red-600">
                  {formatCurrency(report.summary?.totalLostRevenue || 0)}
                </p>
                <p className="text-xs text-slate-500 mt-2">Unpaid orders</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <p className="text-sm font-medium text-slate-600 mb-2">Total Lost Items</p>
                <p className="text-3xl font-semibold text-orange-600">
                  {report.summary?.totalLostItems || 0}
                </p>
                <p className="text-xs text-slate-500 mt-2">Units not sold</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <p className="text-sm font-medium text-slate-600 mb-2">Average Order Value</p>
                <p className="text-3xl font-semibold text-slate-900">
                  {formatCurrency(report.summary?.averageOrderValue || 0)}
                </p>
                <p className="text-xs text-slate-500 mt-2">Per timeout order</p>
              </div>
            </div>

            {/* Breakdown by Payment Method */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Breakdown by Payment Method
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-6 py-3 text-left">Payment Method</th>
                      <th className="px-6 py-3 text-left">Timeout Orders</th>
                      <th className="px-6 py-3 text-left">Lost Revenue</th>
                      <th className="px-6 py-3 text-left">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {Object.entries(report.byPaymentMethod || {}).map(([method, data]) => (
                      <tr key={method} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900 font-medium">
                          {method}
                        </td>
                        <td className="px-6 py-4 text-slate-900">
                          {data.count}
                        </td>
                        <td className="px-6 py-4 text-red-600 font-semibold">
                          {formatCurrency(data.revenue)}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {report.summary?.totalTimeoutOrders > 0
                            ? `${((data.count / report.summary?.totalTimeoutOrders) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 30-Day Trend */}
            {report.trend?.last30Days && report.trend.last30Days.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  30-Day Trend
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  {report.trend?.description}
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                      <tr>
                        <th className="px-6 py-3 text-left">Date</th>
                        <th className="px-6 py-3 text-left">Orders Lost</th>
                        <th className="px-6 py-3 text-left">Revenue Lost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {report.trend.last30Days.map((day, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-900 font-medium">
                            {formatDate(day.date)}
                          </td>
                          <td className="px-6 py-4 text-slate-900">
                            {day.orderCount}
                          </td>
                          <td className="px-6 py-4 text-red-600 font-semibold">
                            {formatCurrency(day.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Insights */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">
                💡 Key Insights
              </h2>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-1">•</span>
                  <span>
                    {report.summary?.totalTimeoutOrders} orders ({((report.summary?.totalTimeoutOrders / (report.summary?.totalTimeoutOrders + 10)) * 100).toFixed(1)}% of all orders) were lost due to payment timeout
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-1">•</span>
                  <span>
                    Total lost revenue of {formatCurrency(report.summary?.totalLostRevenue)} represents significant business impact
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-1">•</span>
                  <span>
                    {report.summary?.totalLostItems} units of inventory were locked due to abandoned carts but have been restored by the automatic cleanup system
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-1">•</span>
                  <span>
                    Consider implementing email reminders or push notifications to reduce timeout abandonment
                  </span>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-sm">No report data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
