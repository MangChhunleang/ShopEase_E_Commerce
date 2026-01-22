// src/CategoriesPage.jsx
import { useEffect, useState } from 'react';
import {
  DevicePhoneMobileIcon,
  SparklesIcon,
  ComputerDesktopIcon,
  GiftIcon,
  PlusIcon,
  ClockIcon,
  BookOpenIcon,
} from '@heroicons/react/24/solid';
import { api } from '../services/api';

export default function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    name: '',
    icon: '',
    color: '',
    logoUrl: '',
    parentCategoryId: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Recommended preset colors for quick selection
  const presetColors = [
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#F472B6', // pink-400
    '#22C55E', // green-500
    '#EA580C', // orange-600
    '#0EA5E9', // sky-500
    '#374151', // gray-700
  ];

  // Preset icons for top-level categories (icon names are saved as strings)
  const presetIcons = [
    { key: 'phone', label: 'Phone', Icon: DevicePhoneMobileIcon },
    { key: 'electronics', label: 'Electronics', Icon: SparklesIcon },
    { key: 'computer', label: 'Computer', Icon: ComputerDesktopIcon },
    { key: 'gaming', label: 'Gaming', Icon: GiftIcon },
    { key: 'health-pharmacy', label: 'Health & Pharmacy', Icon: PlusIcon },
    { key: 'watch', label: 'Watch', Icon: ClockIcon },
    { key: 'book', label: 'Book', Icon: BookOpenIcon },
  ];

  function isValidHexColor(value) {
    if (!value) return false;
    const v = value.trim();
    const hex = v.startsWith('#') ? v.slice(1) : v;
    return (/^[0-9a-fA-F]{6}$/).test(hex) || (/^[0-9a-fA-F]{3}$/).test(hex);
  }

  function normalizeHex(value) {
    if (!value) return '';
    const v = value.trim();
    if (v.startsWith('#')) return v.length === 4 || v.length === 7 ? v : v;
    return isValidHexColor(v) ? `#${v}` : v;
  }

  async function load() {
    try {
      const { data } = await api.get('/admin/categories');
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Load error');
    }
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({
      name: '',
      icon: '',
      color: '',
      logoUrl: '',
      parentCategoryId: ''
    });
    setEditingId(null);
    setError('');
  }

  function startEdit(category) {
    setForm({
      name: category.name || '',
      icon: category.icon || '',
      color: category.color || '',
      logoUrl: category.logoUrl || '',
      parentCategoryId: category.parentCategoryId || ''
    });
    setEditingId(category.id);
    setError('');
  }

  async function save() {
    try {
      if (!form.name || form.name.trim() === '') {
        setError('Category name is required');
        return;
      }

      // Validate color if provided
      const colorValue = form.color ? normalizeHex(form.color) : '';
      if (colorValue && !isValidHexColor(colorValue)) {
        setError('Please provide a valid hex color, e.g. #2E7D32');
        return;
      }

      const payload = {
        name: form.name.trim(),
        icon: form.icon || null,
        color: colorValue || null,
        logoUrl: form.logoUrl || null,
        parentCategoryId: form.parentCategoryId ? Number(form.parentCategoryId) : null
      };

      if (editingId) {
        await api.put(`/admin/categories/${editingId}`, payload);
      } else {
        await api.post('/admin/categories', payload);
      }
      
      resetForm();
      load();
      setError('');
    } catch (err) {
      console.error('Save error:', err);
      const errorMessage = err.response?.data?.error || err.message || (editingId ? 'Update error' : 'Create error');
      setError(errorMessage);
    }
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
        setForm({ ...form, icon: uploadedImages[0] });
      } else {
        setError('Upload failed - no URL returned');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // Clear the file input
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/categories/${id}`);
      setDeleteConfirm(null);
      setError('');
      load();
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete category';
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
            Categories
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Categories Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, edit, and manage product categories
          </p>
        </div>

        <div className="space-y-6">
        {/* Create/Edit Form */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Category' : 'Add Category'}
              </h2>
              <p className="text-sm text-slate-500">
                {editingId ? 'Update category information' : 'Create a new category for products'}
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
                placeholder="Category name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pick color"
                    className="h-9 w-9 rounded-md border border-slate-300"
                    value={isValidHexColor(form.color) ? normalizeHex(form.color) : '#000000'}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                  />
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., #2E7D32 or 2E7D32"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                  />
                  {form.color && (
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:text-slate-900"
                      onClick={() => setForm({ ...form, color: '' })}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-6 w-6 rounded border ${normalizeHex(form.color).toLowerCase() === c.toLowerCase() ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-300'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                      title={c}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500">Optional. Used for accents and badges.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {form.parentCategoryId ? 'Category Image (for subcategories)' : 'Icon'}
              </label>
              {form.parentCategoryId ? (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={uploading}
                  />
                  {form.icon && (
                    <div className="mt-2">
                      <img 
                        src={form.icon.startsWith('http') ? form.icon : `http://localhost:4000${form.icon}`} 
                        alt="Category preview" 
                        className="h-20 w-20 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, icon: '' })}
                        className="mt-1 text-xs text-red-600 hover:text-red-800"
                      >
                        Remove image
                      </button>
                    </div>
                  )}
                  {uploading && <p className="text-xs text-slate-500">Uploading...</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Icon name (e.g., sports_soccer) or pick a preset"
                      value={form.icon}
                      onChange={e => setForm({ ...form, icon: e.target.value })}
                    />
                    {form.icon && (
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900"
                        onClick={() => setForm({ ...form, icon: '' })}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Preset icon selector */}
                  <div className="flex flex-wrap gap-3">
                    {presetIcons.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm ${form.icon === key ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                        onClick={() => setForm({ ...form, icon: key })}
                        title={label}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-slate-500">Preview:</span>
                    {(() => {
                      const match = presetIcons.find(p => p.key === form.icon);
                      const IconComp = match?.Icon;
                      if (IconComp) return <IconComp className="h-6 w-6 text-slate-700" />;
                      if (form.icon) {
                        return (
                          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700">
                            {form.icon}
                          </span>
                        );
                      }
                      return <span className="text-xs text-slate-400">No icon selected</span>;
                    })()}
                  </div>
                  <p className="text-xs text-slate-500">Enter an icon name (e.g., sports_soccer) or choose a preset. Top-level categories use an icon; subcategories use an image.</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo (for top-level categories)</label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (!file.type.startsWith('image/')) {
                      setError('Please select an image file');
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = async () => {
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
                          setForm({ ...form, logoUrl: uploadedImages[0] });
                        } else {
                          setError('Upload failed - no URL returned');
                        }
                      } catch (err) {
                        console.error('Upload error:', err);
                        setError(err.response?.data?.error || 'Image upload failed');
                      } finally {
                        setUploading(false);
                        e.target.value = ''; // Clear the file input
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={uploading}
                />
                {form.logoUrl && (
                  <div className="mt-2">
                    <img 
                      src={form.logoUrl.startsWith('http') ? form.logoUrl : `http://localhost:4000${form.logoUrl}`} 
                      alt="Logo preview" 
                      className="h-16 w-16 object-contain rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logoUrl: '' })}
                      className="mt-1 text-xs text-red-600 hover:text-red-800"
                    >
                      Remove logo
                    </button>
                  </div>
                )}
                {uploading && <p className="text-xs text-slate-500">Uploading...</p>}
                <p className="text-xs text-slate-500">Upload a logo image for top-level categories (displayed in home screen)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={form.parentCategoryId}
                onChange={e => setForm({ ...form, parentCategoryId: e.target.value })}
              >
                <option value="">None (Top-level category)</option>
                {items
                  .filter(cat => !cat.parentCategoryId && cat.id !== editingId)
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Select a parent to make this a subcategory
              </p>
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

        {/* Categories List */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Categories List</h3>
              <p className="text-sm text-slate-500">All product categories</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Parent</th>
                    <th className="px-4 py-3 text-left">Color</th>
                    <th className="px-4 py-3 text-left">Icon</th>
                    <th className="px-4 py-3 text-left">Logo</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map(cat => {
                    const parent = items.find(p => p.id === cat.parentCategoryId);
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700">{cat.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {cat.color && (
                              <div 
                                className="w-4 h-4 rounded-full border border-slate-300"
                                style={{ backgroundColor: cat.color }}
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="text-slate-900 font-medium">{cat.name}</span>
                              {cat.parentCategoryId && (
                                <span className="text-xs text-slate-500">Subcategory</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {parent ? (
                            <span className="text-sm">{parent.name}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {cat.color ? (
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-6 h-6 rounded border border-slate-300"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="text-slate-600 text-xs">{cat.color}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{cat.icon || '-'}</td>
                        <td className="px-4 py-3">
                          {cat.logoUrl ? (
                            <img 
                              src={cat.logoUrl.startsWith('http') ? cat.logoUrl : `http://localhost:4000${cat.logoUrl}`}
                              alt={`${cat.name} logo`}
                              className="h-8 w-8 object-contain"
                            />
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(cat)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(cat.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan="8">No categories yet</td>
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
              Are you sure you want to delete this category? This action cannot be undone. 
              Make sure no products are using this category.
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

