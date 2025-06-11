// app/loginpage.tsx or pages/login.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Correct for App Router, or 'next/router' for Pages Router

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = mode === 'login'
        ? '/api/login'
        : mode === 'signup'
        ? '/api/signup'
        : '/api/forgot-password'; // Placeholder for now

      const payload =
        mode === 'signup'
          ? {
              name: formData.name,
              email: formData.email,
              password: formData.password,
            }
          : {
              email: formData.email,
              password: formData.password,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Something went wrong');
      }

      if (mode === 'login') {
        // localStorage is generally not recommended for auth state due to XSS vulnerability.
        // Rely primarily on HTTP-only cookies managed by your API routes.
        // Keeping it as per your original code, but noting the best practice.
        localStorage.setItem('is_logged_in', 'true'); // This is largely redundant if cookies are primary
        localStorage.setItem('user_email', formData.email); // Consider if this needs to be client-side only.
        router.push('/dashboard');
      } else if (mode === 'signup') {
        setSuccess('Signup successful! You can now log in.');
        setMode('login'); // Redirect to login after successful signup
      } else if (mode === 'forgot') {
        setSuccess('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderButtonLabel = () => {
    if (loading) return 'Submitting...';
    if (mode === 'login') return 'Login';
    if (mode === 'signup') return 'Sign Up';
    return 'Send Reset Link';
  };

  return (
    <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white p-6 sm:p-10 md:p-12 rounded-2xl shadow-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-center text-[#e97917] mb-6">
          {mode === 'login'
            ? 'Login to Lumina'
            : mode === 'signup'
            ? 'Create a Lumina Account'
            : 'Forgot Password'}
        </h1>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {success && <p className="text-green-600 text-sm text-center mb-4">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your Name"
                className="mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e97917]"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e97917]"
              required
            />
          </div>

          {(mode === 'login' || mode === 'signup') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="********"
                className="mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e97917]"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-2 px-4 text-white rounded-lg transition ${
              loading ? 'bg-[#f3ba87] cursor-not-allowed' : 'bg-[#e97917] hover:bg-[#cc620f]'
            }`}
            disabled={loading}
          >
            {renderButtonLabel()}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600 mt-6">
          {mode === 'login' && (
            <>
              <p>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-[#e97917] hover:underline font-semibold"
                >
                  Sign up
                </button>
              </p>
              <p className="mt-2">
                Forgot your password?{' '}
                <button
                  onClick={() => setMode('forgot')}
                  className="text-[#e97917] hover:underline font-semibold"
                >
                  Reset Password
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-[#e97917] hover:underline font-semibold"
              >
                Login
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remembered your password?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-[#e97917] hover:underline font-semibold"
              >
                Back to login
              </button>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}