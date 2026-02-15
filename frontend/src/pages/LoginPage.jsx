// src/LoginPage.jsx
import { useState } from 'react';
import { api } from '../services/api';
import { setToken } from '../services/auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      nav('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        // Matches mobile app primaryBlue: #1976D2
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(25, 118, 210, 0.15), transparent),
          radial-gradient(ellipse 60% 40% at 100% 0%, rgba(25, 118, 210, 0.08), transparent),
          linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)
        `,
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md px-6">
        <div className="login-card rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-slate-950/50 p-8 md:p-10 space-y-8">
          {/* Branding */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1976D2]/20 text-[#5da3f5] mb-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <p className="text-[10px] font-semibold text-[#5da3f5] uppercase tracking-[0.25em]">
              Admin Portal
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">
              ShopEase
            </h1>
            <p className="text-sm text-slate-400">
              Sign in to access the dashboard
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                className="w-full rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-[#1976D2]/60 focus:border-[#1976D2]/60
                  transition-all duration-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                type="email"
                autoComplete="username"
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                className="w-full rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-[#1976D2]/60 focus:border-[#1976D2]/60
                  transition-all duration-200"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#1976D2] text-white font-semibold py-3.5
                hover:bg-[#1565c0] focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:ring-offset-2 focus:ring-offset-slate-900
                disabled:opacity-70 disabled:cursor-not-allowed
                transition-all duration-200 hover:shadow-lg hover:shadow-[#1976D2]/30
                active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Use your admin credentials to continue
          </p>
        </div>
      </div>
    </div>
  );
}
