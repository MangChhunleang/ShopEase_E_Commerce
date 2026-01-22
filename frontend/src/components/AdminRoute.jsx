// src/AdminRoute.jsx
import { Navigate } from 'react-router-dom';
import { isAdmin, isTokenExpired, clearToken } from '../services/auth';
import { useEffect } from 'react';

export function AdminRoute({ children }) {
  useEffect(() => {
    // Check token expiration on mount
    if (isTokenExpired()) {
      clearToken();
    }
  }, []);

  if (isTokenExpired() || !isAdmin()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}