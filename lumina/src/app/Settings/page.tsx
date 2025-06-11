'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [originalData, setOriginalData] = useState({ name: '', email: '' });
  const [initialLoading, setInitialLoading] = useState(true); // Separate loading for initial fetch
  const [submissionLoading, setSubmissionLoading] = useState(false); // Loading for form submission
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Effect to fetch user data on component mount
  useEffect(() => {
    const fetchUser = async () => {
      setInitialLoading(true);
      setError(''); // Clear any previous errors
      try {
        const res = await fetch('/api/login');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to fetch user data.');
        }
        // Set formData and originalData directly from fetched data
        setFormData({ name: data.name, email: data.email, password: '' });
        setOriginalData({ name: data.name, email: data.email });
        setSuccess(''); // Clear success message on re-fetch
      } catch (err) {
        const error = err as Error;
        console.error('Error fetching user data:', error);
        setError(error.message || 'Could not load user profile.');
      } finally {
        setInitialLoading(false);
      }
    };
    fetchUser();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Memoized change handler for form inputs
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear success/error messages when user starts typing again
    setSuccess('');
    setError('');
  }, []);

  // Memoized submit handler for the form
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmissionLoading(true);
    setError('');
    setSuccess('');

    // Construct payload with only changed fields and/or new password
    const updatePayload: { name?: string; email?: string; password?: string } = {};

    if (formData.name !== originalData.name) {
      updatePayload.name = formData.name;
    }
    if (formData.email !== originalData.email) {
      // Basic email format validation before sending to backend
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Invalid email format');
        setSubmissionLoading(false);
        return;
      }
      updatePayload.email = formData.email;
    }
    if (formData.password.trim()) {
      // Basic password length validation
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setSubmissionLoading(false);
        return;
      }
      updatePayload.password = formData.password;
    }

    // If nothing has changed and no password was entered, do nothing
    if (Object.keys(updatePayload).length === 0) {
      setSuccess('No changes to save.');
      setEditing(false); // Exit editing mode if nothing changed
      setSubmissionLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update user profile.');
      }

      // Update originalData with new values
      setOriginalData({ name: formData.name, email: formData.email });
      setSuccess('Profile updated successfully!');
      setEditing(false); // Exit editing mode
      setFormData(prev => ({ ...prev, password: '' })); // Clear password field
    } catch (err) {
      const error = err as Error;
      console.error('Error updating profile:', error);
      setError(error.message || 'An unexpected error occurred during update.');
    } finally {
      setSubmissionLoading(false);
    }
  }, [formData, originalData]); // Dependencies for useCallback

  // Memoized boolean to determine if the "Save Changes" button should be disabled
  const isSaveDisabled = useMemo(() => {
    const hasNameChanged = formData.name !== originalData.name;
    const hasEmailChanged = formData.email !== originalData.email;
    const hasPasswordEntered = formData.password.trim().length > 0;

    return (
      submissionLoading || // Currently submitting
      (!hasNameChanged && !hasEmailChanged && !hasPasswordEntered) // No changes made
    );
  }, [formData, originalData, submissionLoading]);

  if (initialLoading) {
    return (
      <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
        <p className="text-xl text-gray-700">Loading user profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white p-6 sm:p-10 md:p-12 rounded-2xl shadow-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-center text-[#e97917] mb-6">Account Settings</h1>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {success && <p className="text-green-600 text-sm text-center mb-4">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              id="name"
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
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                id="password"
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
                onClick={() => {
                    setEditing(true);
                    setSuccess(''); // Clear success when going into edit mode
                    setError(''); // Clear error when going into edit mode
                }}
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
                disabled={isSaveDisabled}
                className={`w-full py-2 px-4 text-white bg-[#e97917] rounded-lg transition ${
                  isSaveDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#cc620f]'
                }`}
              >
                {submissionLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...originalData, password: '' }); // Reset to original and clear password
                  setEditing(false);
                  setError(''); // Clear error on cancel
                  setSuccess(''); // Clear success on cancel
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