// src/ProductsPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

const STATUSES = ['ACTIVE', 'ARCHIVED'];
const imageFallback = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
    '<rect width="128" height="128" fill="#f1f5f9"/>' +
    '<path d="M38 52h52v24H38z" fill="#cbd5f5"/>' +
    '<circle cx="52" cy="52" r="6" fill="#94a3b8"/>' +
    '<path d="M38 76l18-16 12 10 10-8 12 14H38z" fill="#94a3b8"/>' +
  '</svg>'
)}`;

export default function ProductsPage() {
  const resolveImageUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads')) return url;
    return url;
  };
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    status: 'ACTIVE',
    images: [],
    category: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const leafCategories = categories.filter(cat => !categories.some(c => c.parentCategoryId === cat.id));
  const formatCategoryLabel = (cat) => {
    if (!cat?.parentCategoryId) return cat?.name || '';
    const parent = categories.find(c => c.id === cat.parentCategoryId);
    return parent ? `${parent.name} > ${cat.name}` : cat.name;
  };
  const selectedCategoryMissing = form.category && !leafCategories.some(c => c.name === form.category);

  function ensureArray(val) {
    return Array.isArray(val) ? val : (val?.data != null ? (Array.isArray(val.data) ? val.data : []) : []);
  }

  async function load() {
    try {
      const { data } = await api.get('/admin/products');
      setItems(ensureArray(data));
    } catch (err) {
      setError(err.response?.data?.error || 'Load error');
      setItems([]);
    }
  }

  async function loadCategories() {
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(ensureArray(data));
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([]);
    }
  }

  useEffect(() => { 
    load().catch(err => setError(err.response?.data?.error || 'Load error')); 
    loadCategories();
  }, []);

  function resetForm() {
    setForm({
      name: '',
      description: '',
      price: '',
      stock: '',
      status: 'ACTIVE',
      images: [],
      category: ''
    });
    setEditingId(null);
    setError('');
  }

  function startEdit(product) {
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      stock: product.stock || '',
      status: product.status || 'ACTIVE',
      images: Array.isArray(product.images) ? product.images : [],
      category: product.category || ''
    });
    setEditingId(product.id);
    setError('');
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Please select image files only');
      return;
    }

    try {
      setError('');
      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('images', file);
      });

      const response = await api.post('/admin/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedUrls = response.data.images || [];
      const newImages = [...form.images, ...uploadedUrls];
      setForm({ ...form, images: newImages });
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to upload images';
      setError(errorMessage);
    }
    
    // Reset file input
    e.target.value = '';
  }

  async function removeImage(index) {
    const imageUrl = form.images[index];
    
    // If it's an uploaded file (starts with /uploads), delete it from server
    if (imageUrl && (imageUrl.includes('/uploads/') || imageUrl.includes('localhost:4000/uploads/'))) {
      try {
        // Extract filename from URL
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        if (filename) {
          await api.delete(`/admin/upload/${filename}`);
        }
      } catch (err) {
        console.error('Failed to delete image from server:', err);
        // Continue with local removal even if server deletion fails
      }
    }
    
    const newImages = form.images.filter((_, i) => i !== index);
    setForm({ ...form, images: newImages });
  }

  function moveImage(index, direction) {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === form.images.length - 1) return;

    const newImages = [...form.images];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    setForm({ ...form, images: newImages });
  }

  async function save() {
    try {
      if (!form.name || !form.price) {
        setError('Name and price are required');
        return;
      }

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        status: form.status,
        images: form.images,
        category: form.category || null
      };

      if (editingId) {
        const response = await api.put(`/admin/products/${editingId}`, payload);
        console.log('Update successful:', response.data);
      } else {
        await api.post('/admin/products', payload);
      }
      
      resetForm();
      load();
      setError(''); // Clear any previous errors on success
    } catch (err) {
      console.error('Save error:', err);
      const errorMessage = err.response?.data?.error || err.message || (editingId ? 'Update error' : 'Create error');
      setError(errorMessage);
    }
  }

  async function handleDelete(id) {
    try {
      const response = await api.delete(`/admin/products/${id}`);
      setDeleteConfirm(null);
      setError(''); // Clear any previous errors
      load();
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete product';
      setError(errorMessage);
      setDeleteConfirm(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em]">
            Products
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Products Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, edit, and manage your product catalog
          </p>
        </div>

        <div className="space-y-6">
        {/* Create/Edit Form */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Product' : 'Add Product'}
              </h2>
              <p className="text-sm text-slate-500">
                {editingId ? 'Update product information' : 'Create a new item for the catalog'}
              </p>
            </div>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Product name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price *</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
                type="number"
                step="0.01"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
                type="number"
                value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select category</option>
                {selectedCategoryMissing && (
                  <option value={form.category}>{`Current (not leaf): ${form.category}`}</option>
                )}
                {leafCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{formatCategoryLabel(cat)}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Only subcategories are selectable. Top-level categories appear when they have no children.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Product description"
                rows="3"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Images</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">Upload multiple images. First image will be the primary image.</p>
              {form.images.length > 0 && (
                <div className="mt-3 space-y-2">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      <div className="relative flex-shrink-0">
                        <img 
                          src={resolveImageUrl(img)} 
                          alt={`Preview ${idx + 1}`} 
                          className="w-32 h-32 object-cover rounded border border-slate-200" 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = imageFallback;
                          }}
                        />
                        {idx === 0 && (
                          <span className="absolute top-0 left-0 bg-indigo-600 text-white text-xs px-1 rounded-br">Primary</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 truncate">
                          {img.includes('/uploads/') ? 'Uploaded image' : 'Base64 image'}
                        </p>
                        <p className="text-xs text-slate-400">Position: {idx + 1}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveImage(idx, 'up')}
                          disabled={idx === 0}
                          className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveImage(idx, 'down')}
                          disabled={idx === form.images.length - 1}
                          className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        onClick={() => removeImage(idx)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        title="Delete image"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                onClick={resetForm}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white text-slate-700 font-medium px-4 py-2 shadow-sm hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={save}
              className="inline-flex items-center rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 shadow-sm hover:bg-indigo-700 transition"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {/* Products List */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Products List</h3>
              <p className="text-sm text-slate-500">Latest items by update date</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Image</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{p.id}</td>
                      <td className="px-4 py-3">
                        {Array.isArray(p.images) && p.images.length > 0 ? (
                          <img
                            src={resolveImageUrl(p.images[0])}
                            alt={p.name}
                            className="w-16 h-16 object-cover rounded border border-slate-200"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = imageFallback;
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs text-slate-400">No img</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{p.description || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">${Number(p.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">{p.stock}</td>
                      <td className="px-4 py-3 text-slate-700">{p.category || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(p)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan="11">No products yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

