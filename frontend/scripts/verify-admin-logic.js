#!/usr/bin/env node
/**
 * Run this to verify Dashboard (recent orders) and Products (image URLs) logic
 * without deploying. Usage: node scripts/verify-admin-logic.js
 *
 * Same logic as DashboardPage.jsx loadRecentOrders and ProductsPage.jsx resolveImageUrl.
 */

// ----- Same as Dashboard: parse orders response and slice -----
function getRecentOrdersList(data) {
  const ordersList =
    Array.isArray(data) ? data :
    Array.isArray(data?.data) ? data.data :
    Array.isArray(data?.orders) ? data.orders :
    [];
  const safe = Array.isArray(ordersList) ? ordersList : [];
  return Array.from(safe).slice(0, 5);
}

// ----- Same as ProductsPage: resolve image URL (no /api prefix for uploads) -----
function resolveImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/api/uploads')) return url.replace(/^\/api/, '');
  if (url.startsWith('/uploads')) return url;
  return url;
}

// ----- Tests -----
const orderPayloads = [
  { data: [] },
  { data: [{ id: 1 }, { id: 2 }] },
  [{ id: 1 }],
  { data: { items: [] } },
  null,
  undefined,
  {},
  { orders: [1, 2, 3] },
  { data: [], pagination: { page: 1 } },
];

const imageUrls = [
  '/uploads/products/foo.jpg',
  '/api/uploads/products/foo.jpg',
  'https://example.com/img.png',
  '/uploads/banners/banner.png',
  '',
  null,
];

let failed = 0;

console.log('Testing orders parsing (must never throw, result must be array)...\n');
for (const payload of orderPayloads) {
  try {
    const list = getRecentOrdersList(payload);
    if (!Array.isArray(list)) {
      console.log('FAIL:', JSON.stringify(payload), '-> not an array:', list);
      failed++;
    } else {
      const preview = (JSON.stringify(payload) ?? 'undefined').slice(0, 50);
      console.log('OK:', preview + '... -> length', list.length);
    }
  } catch (e) {
    console.log('THROW:', JSON.stringify(payload), e.message);
    failed++;
  }
}

console.log('\nTesting image URL resolution...\n');
for (const url of imageUrls) {
  try {
    const out = resolveImageUrl(url);
    const bad = out && typeof out === 'string' && out.startsWith('/api/uploads');
    if (bad) {
      console.log('FAIL: still /api/uploads:', url, '->', out);
      failed++;
    } else {
      console.log('OK:', String(url).slice(0, 40), '->', String(out).slice(0, 40));
    }
  } catch (e) {
    console.log('THROW:', url, e.message);
    failed++;
  }
}

console.log('\n' + (failed === 0 ? 'All checks passed.' : failed + ' check(s) failed.'));
process.exit(failed > 0 ? 1 : 0);
