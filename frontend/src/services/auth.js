// src/auth.js
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'admin_token';

export function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }
export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export function isTokenExpired() {
  const token = getToken();
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
}

export function getRole() {
  const t = getToken(); 
  if (!t || isTokenExpired()) return null;
  try { 
    const decoded = jwtDecode(t);
    return decoded.role; 
  } catch { 
    return null; 
  }
}

export function isAdmin() { 
  const role = getRole();
  return role === 'ADMIN'; 
}