// src/UsersPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  async function loadUsers() {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      
      const { data } = await api.get(`/admin/users?${params.toString()}`);
      setUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
      console.error('Load users error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    // Client-side search filtering
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => 
      user.email?.toLowerCase().includes(query) ||
      user.phoneNumber?.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  async function handleStatusToggle(user) {
    if (!window.confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.email}?`)) {
      return;
    }

    try {
      await api.patch(`/admin/users/${user.id}/status`, {
        isActive: !user.isActive
      });
      await loadUsers();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user status');
      console.error('Update status error:', err);
    }
  }

  async function loadUserDetails(userId) {
    try {
      setLoadingOrders(true);
      setError('');
      const { data } = await api.get(`/admin/users/${userId}`);
      setSelectedUser(data);
      
      // Load order history
      const ordersResponse = await api.get(`/admin/users/${userId}/orders`);
      setUserOrders(ordersResponse.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load user details');
      console.error('Load user details error:', err);
    } finally {
      setLoadingOrders(false);
    }
  }

  function closeUserDetails() {
    setSelectedUser(null);
    setUserOrders([]);
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em]">
            Users
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Users Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer accounts and admin users
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-slate-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-6 py-3 text-left">ID</th>
                      <th className="px-6 py-3 text-left">Email</th>
                      <th className="px-6 py-3 text-left">Phone</th>
                      <th className="px-6 py-3 text-left">Role</th>
                      <th className="px-6 py-3 text-left">Orders</th>
                      <th className="px-6 py-3 text-left">Total Spent</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Joined</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-700">{user.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {user.phoneNumber || '-'}
                          {user.isPhoneVerified && user.phoneNumber && (
                            <span className="ml-1 text-green-600" title="Verified">✓</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'ADMIN' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{user.orderCount || 0}</td>
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {formatCurrency(user.totalSpent || 0)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadUserDetails(user.id)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleStatusToggle(user)}
                              className={`text-sm font-medium ${
                                user.isActive
                                  ? 'text-red-600 hover:text-red-800'
                                  : 'text-green-600 hover:text-green-800'
                              }`}
                            >
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-600">
                  Showing {filteredUsers.length} of {users.length} users
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">User Details</h3>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
              </div>
              <button
                onClick={closeUserDetails}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <p className="text-slate-900">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <p className="text-slate-900">
                    {selectedUser.phoneNumber || '-'}
                    {selectedUser.isPhoneVerified && selectedUser.phoneNumber && (
                      <span className="ml-1 text-green-600">✓ Verified</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedUser.role === 'ADMIN' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedUser.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Joined</label>
                  <p className="text-slate-900">{formatDate(selectedUser.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Updated</label>
                  <p className="text-slate-900">{formatDate(selectedUser.updatedAt)}</p>
                </div>
              </div>

              {/* User Stats */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-md font-semibold text-slate-900 mb-4">Activity Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedUser.stats?.totalOrders || 0}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-yellow-700">{selectedUser.stats?.pendingOrders || 0}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Processing</p>
                    <p className="text-2xl font-bold text-blue-700">{selectedUser.stats?.processingOrders || 0}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Delivered</p>
                    <p className="text-2xl font-bold text-green-700">{selectedUser.stats?.deliveredOrders || 0}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-indigo-700">{formatCurrency(selectedUser.stats?.totalSpent || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Order History */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-md font-semibold text-slate-900 mb-4">Order History</h4>
                {loadingOrders ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <p className="mt-2 text-sm text-slate-500">Loading orders...</p>
                  </div>
                ) : userOrders.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No orders found</p>
                ) : (
                  <div className="space-y-4">
                    {userOrders.map((order) => (
                      <div key={order.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-slate-900">{order.orderNumber}</p>
                            <p className="text-xs text-slate-500">{formatDate(order.orderDate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900">{formatCurrency(order.total)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <p className="text-xs text-slate-600">
                            {order.items?.length || 0} item(s) • {order.paymentMethod}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
}

