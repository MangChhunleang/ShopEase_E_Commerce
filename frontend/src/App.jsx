// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
import Layout from './components/Layout';
import ProductsPage from './pages/ProductsPage';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import CategoriesPage from './pages/CategoriesPage';
import UsersPage from './pages/UsersPage';
import BannersPage from './pages/BannersPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/products"
          element={
            <AdminRoute>
              <Layout>
                <ProductsPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <AdminRoute>
              <Layout>
                <OrdersPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <AdminRoute>
              <Layout>
                <CategoriesPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <Layout>
                <UsersPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route
          path="/banners"
          element={
            <AdminRoute>
              <Layout>
                <BannersPage />
              </Layout>
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;