// src/BannersPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

const LINK_TYPES = [
  { value: 'category', label: 'Category' }
];

export default function BannersPage() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    imageUrl: '',
    linkType: 'category',
    linkValue: '',
    displayOnHome: true
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/admin/banners');
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Load error');
    }
  }

  async function loadProducts() {
    try {
      const { data } = await api.get('/admin/products');
      setProducts(data.filter(p => p.status === 'ACTIVE'));
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  async function loadCategories() {
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  useEffect(() => { 
    load();
    loadCategories();
  }, []);

  function resetForm() {
    setForm({
      imageUrl: '',
      linkType: 'category',
      linkValue: '',
      displayOnHome: true
    });
    setEditingId(null);
    setError('');
  }

  function startEdit(banner) {
    setForm({
      imageUrl: banner.imageUrl || '',
      linkType: banner.linkType || 'none',
      linkValue: banner.linkValue || '',
      displayOnHome: banner.displayOnHome !== undefined ? banner.displayOnHome : true
    });
    setEditingId(banner.id);
    setError('');
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    try {
      setError('');
      setUploading(true);
      const formData = new FormData();
      formData.append('images', file);

      const response = await api.post('/admin/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedImages = response.data?.images || [];
      if (uploadedImages.length > 0) {
        setForm({ ...form, imageUrl: uploadedImages[0] });
      } else {
        setError('Upload failed - no URL returned');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    try {
      if (!form.imageUrl || form.imageUrl.trim() === '') {
        setError('Banner image is required');
        return;
      }

      if (!form.displayOnHome && (!form.linkValue || form.linkValue.trim() === '')) {
        setError('Category is required for category banner');
        return;
      }

      const payload = {
        imageUrl: form.imageUrl.trim(),
        linkType: form.displayOnHome ? 'none' : 'category',
        linkValue: form.displayOnHome ? null : form.linkValue.trim(),
        displayOnHome: !!form.displayOnHome
      };

      if (editingId) {
        await api.put(`/admin/banners/${editingId}`, payload);
      } else {
        await api.post('/admin/banners', payload);
      }
      
      await load();
      resetForm();
      setError('');
    } catch (err) {
      console.error('Save error:', err);
      const errorMessage = err.response?.data?.error || err.message || (editingId ? 'Update error' : 'Create error');
      setError(errorMessage);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/banners/${id}`);
      setDeleteConfirm(null);
      setError('');
      load();
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete banner';
      setError(errorMessage);
      setDeleteConfirm(null);
    }
  }

  function getLinkDisplay(banner) {
    if (banner.linkType === 'category') {
      const category = categories.find(c => c.name === banner.linkValue);
      return category ? category.name : banner.linkValue;
    }
    return banner.linkValue;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em]">
            Banners
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Banner Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, edit, and manage promotional banners
          </p>
        </div>

        <div className="space-y-6">
        {/* Create/Edit Form */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Banner' : 'Add Banner'}
              </h2>
              <p className="text-sm text-slate-500">
                {editingId ? 'Update banner information' : 'Create a new promotional banner'}
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Image *</label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {uploading && <p className="text-xs text-slate-500">Uploading...</p>}
                {form.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={form.imageUrl} 
                      alt="Preview" 
                      className="max-w-full h-32 object-cover rounded-lg border border-slate-200"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!form.displayOnHome && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.linkValue}
                    onChange={e => setForm({ ...form, linkValue: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {categories.filter(c => !c.parentCategoryId).map(category => (
                      <option key={category.id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="displayOnHome"
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  checked={form.displayOnHome}
                  onChange={e => setForm({ ...form, displayOnHome: e.target.checked })}
                />
                <label htmlFor="displayOnHome" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Display on Home Screen
                </label>
              </div>
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

        {/* Banners List */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Banners List</h3>
              <p className="text-sm text-slate-500">All promotional banners</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Preview</th>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Link</th>
                    <th className="px-4 py-3 text-left">Home</th>
                    <th className="px-4 py-3 text-left">Dates</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map(banner => (
                    <tr key={banner.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <img 
                          src={banner.imageUrl} 
                          alt={banner.title}
                          className="w-20 h-12 object-cover rounded border border-slate-200"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="48"%3E%3Crect fill="%23e2e8f0" width="80" height="48"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="10"%3EImage%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-900 font-medium">{banner.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-500">{banner.linkType}</span>
                          <span className="text-slate-700 text-xs max-w-xs truncate">{getLinkDisplay(banner)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {banner.displayOnHome ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                            </svg>
                            Home
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <div className="flex flex-col gap-1">
                          {banner.startDate && (
                            <span>Start: {new Date(banner.startDate).toLocaleDateString()}</span>
                          )}
                          {banner.endDate && (
                            <span>End: {new Date(banner.endDate).toLocaleDateString()}</span>
                          )}
                          {!banner.startDate && !banner.endDate && <span>-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(banner)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(banner.id)}
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
                      <td className="px-4 py-6 text-center text-slate-500" colSpan="6">No banners yet</td>
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
              Are you sure you want to delete this banner? This action cannot be undone.
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


