// src/LoginPage.jsx
import { useState } from 'react';
import { api } from '../services/api';
import { setToken } from '../services/auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      nav('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-slate-200 p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-medium text-indigo-600 uppercase tracking-[0.2em]">Admin</p>
          <h2 className="text-2xl font-semibold text-slate-900">Sign in to dashboard</h2>
          <p className="text-sm text-slate-500">Use the seeded admin credentials</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 text-white font-medium py-2.5 shadow-sm hover:bg-indigo-700 transition"
          >
            Sign in
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-slate-500">Default admin: admin@example.com / Admin123!</p>
      </div>
    </div>
  );
}