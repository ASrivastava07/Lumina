'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [originalData, setOriginalData] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/login');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch user');
        setFormData({ ...formData, name: data.name, email: data.email });
        setOriginalData({ name: data.name, email: data.email });
      } catch (err) {
        const error = err as Error;
        setError(error.message);
      }
    };
    fetchUser();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const updatePayload: { name: string; email: string; password?: string } = {
      name: formData.name,
      email: formData.email,
    };
    if (formData.password.trim()) updatePayload.password = formData.password;

    try {
      const res = await fetch('/api/login', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
        });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update user');

      setOriginalData({ name: formData.name, email: formData.email });
      setSuccess('Profile updated successfully');
      setEditing(false);
      setFormData(prev => ({ ...prev, password: '' }));
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white p-6 sm:p-10 md:p-12 rounded-2xl shadow-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-center text-[#e97917] mb-6">Account Settings</h1>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {success && <p className="text-green-600 text-sm text-center mb-4">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              disabled={!editing}
              onChange={handleChange}
              className={`mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none ${
                editing ? 'focus:ring-2 focus:ring-[#e97917]' : 'bg-gray-100 cursor-not-allowed'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
                type="email"
                name="email"
                value={formData.email}
                disabled={!editing}
                onChange={handleChange}
                className={`mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none ${
                editing ? 'focus:ring-2 focus:ring-[#e97917]' : 'bg-gray-100 cursor-not-allowed'
              }`}
            />
          </div>

          {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current"
                className="mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e97917]"
              />
            </div>
          )}

          {!editing ? (
            <>
                <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full py-2 px-4 text-white bg-[#e97917] hover:bg-[#cc620f] rounded-lg"
                >
                Edit Info
                </button>
                <Link
                href="/dashboard"
                className="block w-full text-center mt-3 py-2 px-4 text-[#e97917] border border-[#e97917] hover:bg-[#fff3e4] rounded-lg"
                >
                Go to Dashboard
                </Link>
            </>
            ) : (
            <div className="flex gap-4">
                <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 text-white bg-[#e97917] hover:bg-[#cc620f] rounded-lg"
                >
                {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                type="button"
                onClick={() => {
                    setFormData({ ...originalData, password: '' });
                    setEditing(false);
                }}
                className="w-full py-2 px-4 text-black bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                Cancel
                </button>
            </div>
            )}
        </form>
      </div>
    </main>
  );
}
