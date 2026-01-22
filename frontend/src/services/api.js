// src/api.js
import axios from 'axios';
import { getToken, clearToken } from './auth';

// Hardcode backend base URL to avoid env misconfig
const baseURL = 'http://localhost:4000';

export const api = axios.create({ baseURL });
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 errors (token expired/invalid)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear it and redirect to login
      clearToken();
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);