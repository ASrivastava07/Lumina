'use client'; // This marks the component as a Client Component, ensuring it runs on the user's browser.

import { useEffect, useState, useCallback, useMemo } from 'react'; // Importing essential React hooks for managing state, side effects, and performance optimizations.
import Link from 'next/link'; // Importing the Link component from Next.js for client-side navigation.

// This is the main component for the user's account settings page.
export default function SettingsPage() {
  // State to hold the current values of the form inputs (name, email, password).
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  // State to store the original user data fetched from the server. This is used to compare for changes.
  const [originalData, setOriginalData] = useState({ name: '', email: '' });
  // State to manage the loading status specifically for the initial data fetch.
  const [initialLoading, setInitialLoading] = useState(true);
  // State to manage the loading status when the form is being submitted (e.g., saving changes).
  const [submissionLoading, setSubmissionLoading] = useState(false);
  // State to control whether the input fields are editable or read-only.
  const [editing, setEditing] = useState(false);
  // State to store and display any error messages to the user.
  const [error, setError] = useState('');
  // State to store and display any success messages to the user.
  const [success, setSuccess] = useState('');

  // useEffect hook to fetch user data when the component first loads.
  useEffect(() => {
    // Defines an asynchronous function to fetch the user's profile information.
    const fetchUser = async () => {
      setInitialLoading(true); // Start loading, show loading indicator.
      setError(''); // Clear any previous error messages before fetching.
      try {
        // Make an API call to retrieve user data. Assuming '/api/login' also serves user profile.
        const res = await fetch('/api/login');
        const data = await res.json(); // Parse the JSON response.

        // Check if the API response was not successful (e.g., HTTP status 4xx or 5xx).
        if (!res.ok) {
          // Throw an error if the fetch failed, using the message from the API or a default one.
          throw new Error(data.message || 'Failed to fetch user data.');
        }
        // Update both formData (for the inputs) and originalData (for comparison) with the fetched data.
        // The password field is intentionally left blank for security reasons; it's not fetched.
        setFormData({ name: data.name, email: data.email, password: '' });
        setOriginalData({ name: data.name, email: data.email });
        setSuccess(''); // Clear any success message that might have been present.
      } catch (err) {
        // Catch any errors during the fetch process.
        const error = err as Error; // Type assertion for the error object.
        console.error('Error fetching user data:', error); // Log the error for debugging.
        setError(error.message || 'Could not load user profile.'); // Display an error message to the user.
      } finally {
        setInitialLoading(false); // End loading, hide loading indicator.
      }
    };
    fetchUser(); // Call the fetchUser function immediately when the component mounts.
  }, []); // The empty dependency array ensures this effect runs only once after the initial render.

  // useCallback hook to memoize the handleChange function. This prevents unnecessary re-renders of child components.
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Update the formData state by spreading the previous state and overriding the changed field.
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear any success or error messages as soon as the user starts typing, indicating new input.
    setSuccess('');
    setError('');
  }, []); // Empty dependency array means this function is created once and reused.

  // useCallback hook to memoize the handleSubmit function. This optimizes performance by preventing re-creation on every render.
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent the default browser form submission behavior.
    setSubmissionLoading(true); // Indicate that the form is being submitted.
    setError(''); // Clear any existing error messages.
    setSuccess(''); // Clear any existing success messages.

    // Initialize an empty object to build the payload with only the fields that have actually changed.
    const updatePayload: { name?: string; email?: string; password?: string } = {};

    // Check if the name has changed from its original value.
    if (formData.name !== originalData.name) {
      updatePayload.name = formData.name; // Add the new name to the payload.
    }
    // Check if the email has changed from its original value.
    if (formData.email !== originalData.email) {
      // Perform a basic client-side validation for email format.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Invalid email format'); // Display an error if the email format is invalid.
        setSubmissionLoading(false); // Stop loading.
        return; // Stop the submission process.
      }
      updatePayload.email = formData.email; // Add the new email to the payload.
    }
    // Check if a new password has been entered (i.e., the password field is not empty after trimming whitespace).
    if (formData.password.trim()) {
      // Perform a basic client-side validation for password length.
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.'); // Display an error if password is too short.
        setSubmissionLoading(false); // Stop loading.
        return; // Stop the submission process.
      }
      updatePayload.password = formData.password; // Add the new password to the payload.
    }

    // If the payload is empty, it means no changes were made and no new password was entered.
    if (Object.keys(updatePayload).length === 0) {
      setSuccess('No changes to save.'); // Inform the user that nothing needs saving.
      setEditing(false); // Exit editing mode since there's nothing to save.
      setSubmissionLoading(false); // Stop loading.
      return; // Stop the submission process.
    }

    try {
      // Send a PATCH request to update the user's profile. Assuming '/api/login' handles PATCH for updates.
      const res = await fetch('/api/login', {
        method: 'PATCH', // Use PATCH for partial updates.
        headers: { 'Content-Type': 'application/json' }, // Specify content type.
        body: JSON.stringify(updatePayload), // Send the payload as a JSON string.
      });

      const data = await res.json(); // Parse the JSON response.
      // Check if the API response was not successful.
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update user profile.'); // Throw an error if update failed.
      }

      // If the update was successful, update the originalData state to reflect the new saved values.
      setOriginalData({ name: formData.name, email: formData.email });
      setSuccess('Profile updated successfully!'); // Display a success message.
      setEditing(false); // Exit editing mode.
      setFormData(prev => ({ ...prev, password: '' })); // Clear the password field after successful update.
    } catch (err) {
      // Catch any errors that occur during the update process.
      const error = err as Error;
      console.error('Error updating profile:', error); // Log the error.
      setError(error.message || 'An unexpected error occurred during update.'); // Display an error message.
    } finally {
      setSubmissionLoading(false); // Always stop submission loading, whether successful or failed.
    }
  }, [formData, originalData]); // Dependencies for useCallback: re-create if formData or originalData changes.

  // useMemo hook to calculate whether the "Save Changes" button should be disabled.
  // This value is re-calculated only when its dependencies change, optimizing performance.
  const isSaveDisabled = useMemo(() => {
    // Check if the name field has been modified.
    const hasNameChanged = formData.name !== originalData.name;
    // Check if the email field has been modified.
    const hasEmailChanged = formData.email !== originalData.email;
    // Check if there's any text in the password field (indicating a desire to change password).
    const hasPasswordEntered = formData.password.trim().length > 0;

    // The button is disabled if:
    // 1. A submission is currently in progress.
    // 2. No changes have been made to name or email, AND no new password has been entered.
    return (
      submissionLoading ||
      (!hasNameChanged && !hasEmailChanged && !hasPasswordEntered)
    );
  }, [formData, originalData, submissionLoading]); // Dependencies for useMemo.

  // If the initial data is still loading, display a simple loading message.
  if (initialLoading) {
    return (
      <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
        <p className="text-xl text-gray-700">Loading user profile...</p>
      </main>
    );
  }

  // The main rendering of the settings page.
  return (
    // Main container for the entire page, providing background and centering.
    <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
      {/* Styled container for the settings form, with shadows and rounded corners. */}
      <div className="w-full max-w-xl bg-white p-6 sm:p-10 md:p-12 rounded-2xl shadow-xl border border-gray-200">
        {/* Page title. */}
        <h1 className="text-2xl font-bold text-center text-[#e97917] mb-6">Account Settings</h1>

        {/* Conditional display for error messages. */}
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {/* Conditional display for success messages. */}
        {success && <p className="text-green-600 text-sm text-center mb-4">{success}</p>}

        {/* The settings update form. */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input field. */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              disabled={!editing} // Disabled if not in editing mode.
              onChange={handleChange}
              className={`mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none ${
                editing ? 'focus:ring-2 focus:ring-[#e97917]' : 'bg-gray-100 cursor-not-allowed' // Styling changes based on editing mode.
              }`}
            />
          </div>

          {/* Email input field. */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              disabled={!editing} // Disabled if not in editing mode.
              onChange={handleChange}
              className={`mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none ${
                editing ? 'focus:ring-2 focus:ring-[#e97917]' : 'bg-gray-100 cursor-not-allowed' // Styling changes based on editing mode.
              }`}
            />
          </div>

          {/* New Password input field, only shown when in editing mode. */}
          {editing && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current" // Hint for the user.
                className="mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e97917]"
              />
            </div>
          )}

          {/* Conditional rendering of buttons based on 'editing' mode. */}
          {!editing ? ( // If not in editing mode, show "Edit Info" and "Go to Dashboard" buttons.
            <>
              <button
                type="button" // Type 'button' prevents form submission.
                onClick={() => {
                    setEditing(true); // Switch to editing mode.
                    setSuccess(''); // Clear messages when entering edit mode.
                    setError('');
                }}
                className="w-full py-2 px-4 text-white bg-[#e97917] hover:bg-[#cc620f] rounded-lg"
              >
                Edit Info
              </button>
              {/* Link to navigate to the dashboard. */}
              <Link
                href="/dashboard"
                className="block w-full text-center mt-3 py-2 px-4 text-[#e97917] border border-[#e97917] hover:bg-[#fff3e4] rounded-lg"
              >
                Go to Dashboard
              </Link>
            </>
          ) : ( // If in editing mode, show "Save Changes" and "Cancel" buttons.
            <div className="flex gap-4"> {/* Flex container for spacing between buttons. */}
              <button
                type="submit" // Type 'submit' triggers the handleSubmit function.
                disabled={isSaveDisabled} // Disabled based on the memoized isSaveDisabled value.
                className={`w-full py-2 px-4 text-white bg-[#e97917] rounded-lg transition ${
                  isSaveDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#cc620f]' // Styling for disabled state.
                }`}
              >
                {submissionLoading ? 'Saving...' : 'Save Changes'} {/* Dynamic button text during submission. */}
              </button>
              <button
                type="button" // Type 'button' prevents form submission.
                onClick={() => {
                  setFormData({ ...originalData, password: '' }); // Reset form data to original values and clear password.
                  setEditing(false); // Exit editing mode.
                  setError(''); // Clear error on cancel.
                  setSuccess(''); // Clear success on cancel.
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
