'use client'; // This directive marks the component as a Client Component in Next.js, meaning it runs on the browser.

import { useState } from 'react'; // Importing the useState hook from React to manage component state.
import { useRouter } from 'next/navigation'; // Importing useRouter from Next.js to programmatically navigate between routes.

// Defining a type for the authentication mode. This helps ensure only 'login', 'signup', or 'forgot' are used.
type AuthMode = 'login' | 'signup' | 'forgot';

// The main authentication page component. This component handles both user login and registration.
export default function AuthPage() {
  // Initializing the Next.js router for navigation.
  const router = useRouter();

  // State to control whether the user is in 'login', 'signup', or 'forgot password' mode.
  const [mode, setMode] = useState<AuthMode>('login');

  // State to hold the data entered into the form fields (name, email, password).
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  // State to indicate if an API request is currently in progress, used for showing loading indicators.
  const [loading, setLoading] = useState(false);
  // State to store any error messages received from the API or during form submission.
  const [error, setError] = useState('');
  // State to store success messages, typically shown after successful actions like signup.
  const [success, setSuccess] = useState('');

  // Handler for input field changes. It updates the formData state as the user types.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Uses the input's 'name' attribute to dynamically update the corresponding field in formData.
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handler for form submission. This function makes the API call for login or signup.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevents the default form submission behavior, which would cause a page reload.

    // Set loading state to true and clear any previous error/success messages.
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Determine the API endpoint based on the current mode (login, signup, or forgot password).
      const endpoint = mode === 'login'
        ? '/api/login'
        : mode === 'signup'
        ? '/api/signup'
        : '/api/forgot-password'; // This is a placeholder and would need a dedicated 'forgot' mode handling.

      // Prepare the data payload to be sent with the API request.
      // For signup, include the name; for login/forgot, only email and password are needed.
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

      // Send the request to the backend API.
      const res = await fetch(endpoint, {
        method: 'POST', // Using the POST method for sending data.
        headers: {
          'Content-Type': 'application/json', // Specifying that the request body is JSON.
        },
        body: JSON.stringify(payload), // Converting the JavaScript payload object into a JSON string.
      });

      // Parse the JSON response from the API.
      const result = await res.json();

      // Check if the HTTP response was not OK (e.g., status 400, 500).
      if (!res.ok) {
        // If the response indicates an error, throw an error with the message from the API or a default one.
        throw new Error(result.message || 'Something went wrong');
      }

      // Handle successful responses based on the current mode.
      if (mode === 'login') {
        // Upon successful login, store simple flags in local storage.
        // NOTE: Storing auth tokens or sensitive data directly in localStorage is generally not recommended
        // due to XSS vulnerabilities. HTTP-only cookies are a more secure approach for managing sessions.
        localStorage.setItem('is_logged_in', 'true');
        localStorage.setItem('user_email', formData.email);
        // Redirect the user to the dashboard page.
        router.push('/dashboard');
      } else if (mode === 'signup') {
        // After successful signup, display a success message and switch to the login form.
        setSuccess('Signup successful! You can now log in.');
        setMode('login');
      } else if (mode === 'forgot') {
        // Placeholder for forgot password success.
        setSuccess('Password reset link sent to your email.');
      }
    } catch (err: any) {
      // Catch any errors that occur during the fetch operation or from the API response.
      setError(err.message); // Set the error state to display the error message to the user.
    } finally {
      // This block always executes after try/catch, whether successful or not.
      setLoading(false); // Reset the loading state, allowing the button to be clickable again.
    }
  };

  // Helper function to determine the text displayed on the submit button.
  const renderButtonLabel = () => {
    if (loading) return 'Submitting...'; // Show 'Submitting...' when an API request is active.
    if (mode === 'login') return 'Login';
    if (mode === 'signup') return 'Sign Up';
    return 'Send Reset Link'; // For the 'forgot password' mode.
  };

  // The JSX structure that defines the user interface for the authentication page.
  return (
    // Main container for the entire page, providing a background color and centering the content.
    <main className="min-h-screen bg-[#fcf1d9] flex items-center justify-center px-4">
      {/* Container for the form, styled with Tailwind CSS for appearance and responsiveness. */}
      <div className="w-full max-w-xl bg-white p-6 sm:p-10 md:p-12 rounded-2xl shadow-xl border border-gray-200">
        {/* Dynamic title based on the current authentication mode. */}
        <h1 className="text-2xl font-bold text-center text-[#e97917] mb-6">
          {mode === 'login'
            ? 'Login to Lumina'
            : mode === 'signup'
            ? 'Create a Lumina Account'
            : 'Forgot Password'}
        </h1>

        {/* Display error message if the 'error' state is not empty. */}
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {/* Display success message if the 'success' state is not empty. */}
        {success && <p className="text-green-600 text-sm text-center mb-4">{success}</p>}

        {/* The main form element, which triggers handleSubmit on submission. */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Conditionally render the 'Name' input field only when in 'signup' mode. */}
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
                required // Makes this field mandatory.
              />
            </div>
          )}

          {/* Email input field, always visible regardless of mode. */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="mt-1 w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e97917]"
              required // Makes this field mandatory.
            />
          </div>

          {/* Password input field, visible for 'login' and 'signup' modes. */}
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
                required // Makes this field mandatory.
              />
            </div>
          )}

          {/* The submit button for the form. Its text and disabled state depend on the current mode and loading status. */}
          <button
            type="submit"
            className={`w-full py-2 px-4 text-white rounded-lg transition ${
              loading ? 'bg-[#f3ba87] cursor-not-allowed' : 'bg-[#e97917] hover:bg-[#cc620f]'
            }`}
            disabled={loading} // Disable the button while an API request is in progress.
          >
            {renderButtonLabel()} {/* Displays the appropriate label for the button. */}
          </button>
        </form>

        {/* Section for mode switching links (e.g., "Don't have an account? Sign up"). */}
        <div className="text-center text-sm text-gray-600 mt-6">
          {/* Display signup link when in 'login' mode. */}
          {mode === 'login' && (
            <>
              <p>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setMode('signup')} // Button to switch to signup mode.
                  className="text-[#e97917] hover:underline font-semibold"
                >
                  Sign up
                </button>
              </p>
            </>
          )}
          {/* Display login link when in 'signup' mode. */}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')} // Button to switch back to login mode.
                className="text-[#e97917] hover:underline font-semibold"
              >
                Login
              </button>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
