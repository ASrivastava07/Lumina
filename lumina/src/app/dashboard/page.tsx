'use client'; // This directive marks this component as a Client Component, meaning it runs in the user's browser.

import Link from 'next/link'; // Used for client-side navigation to other pages like the Timer or Settings.
import React, { useEffect, useState, useCallback, useMemo } from 'react'; // Core React hooks for managing component state, side effects, and performance optimizations.
import { Bar, Doughnut } from 'react-chartjs-2'; // Importing chart components for displaying study data visually.
import { useRouter } from 'next/navigation'; // Hook from Next.js for programmatic navigation, suitable for App Router.

// Registering necessary components from Chart.js library. This is a one-time setup.
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

// Defining the structure for a Task object, ensuring type safety.
interface Task {
  id: number;
  title: string;
  category: string; // The category this task belongs to (e.g., 'Math', 'Science').
  deadline: string; // The due date for the task.
  completed: boolean; // Indicates if the task has been marked as finished.
}

// Defining the structure for StudyHours, where keys are subjects and values are hours.
interface StudyHours {
  [subject: string]: number;
}

// Defining the structure for SubjectColorsMap, associating subjects with their display colors.
interface SubjectColorsMap {
  [subject: string]: string;
}

// Defining props for the reusable Modal component.
interface ModalProps {
  isOpen: boolean; // Controls whether the modal is visible.
  onClose: () => void; // Function to call when the modal is closed.
  onConfirm: () => void; // Function to call when a confirmation action is taken.
  title: string; // The title displayed at the top of the modal.
  message: string; // The main content message within the modal.
  isConfirm: boolean; // If true, displays 'Confirm' and 'Cancel' buttons; otherwise, just 'Okay'.
}

// Reusable Modal Component: Designed to replace browser's native alert() and confirm() for better UI.
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, message, isConfirm }) => {
  if (!isOpen) return null; // If the modal is not open, render nothing.

  return (
    // Fixed overlay to cover the entire screen, with a semi-transparent background.
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 font-sans">
      {/* The modal content container, styled for appearance. */}
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-auto flex flex-col items-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">{title}</h3> {/* Modal title */}
        <p className="text-gray-600 mb-6 text-center text-sm">{message}</p> {/* Modal message */}
        <div className="flex space-x-4 w-full justify-center">
          {/* Conditional rendering for the 'Confirm' button if it's a confirmation modal. */}
          {isConfirm && (
            <button
              onClick={() => {
                onConfirm(); // Execute the confirmation action.
                onClose(); // Close the modal after confirmation.
              }}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition flex-grow"
            >
              Confirm
            </button>
          )}
          {/* The main action button, dynamically styled and labeled based on 'isConfirm'. */}
          <button
            onClick={onClose} // Always close the modal when this button is clicked.
            className={`px-4 py-2 rounded-md transition ${isConfirm ? 'bg-gray-300 text-gray-800 hover:bg-gray-400 flex-grow' : 'bg-orange-500 text-white hover:bg-orange-600 flex-grow'}`}
          >
            {isConfirm ? 'Cancel' : 'Okay'} {/* Label changes based on modal type. */}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
export default function Dashboard() {
  const router = useRouter(); // Initialize Next.js router for navigation.
  const today = new Date().toISOString().split('T')[0]; // Get today's date in 'YYYY-MM-DD' format.

  // --- State Declarations ---
  // All state hooks are declared at the top level of the component.
  const [userName, setUserName] = useState<string>(''); // Stores the logged-in user's name.
  const [selectedDate, setSelectedDate] = useState<string>(today); // Stores the date for which study hours are displayed.
  const [studyHours, setStudyHours] = useState<StudyHours>({}); // Stores study hours data per subject for the selected date.
  const [tasks, setTasks] = useState<Task[]>([]); // Stores the list of user tasks.
  const [subjects, setSubjects] = useState<string[]>([]); // Stores list of study subjects (from user preferences).
  const [categories, setCategories] = useState<string[]>([]); // Stores list of task categories.
  const [newCategory, setNewCategory] = useState<string>(''); // Input for adding a new task category.
  const [selectedCategoryToDelete, setSelectedCategoryToDelete] = useState<string>(''); // Selected category for deletion.
  const [subjectColorsMap, setSubjectColorsMap] = useState<SubjectColorsMap>({}); // Map of subjects to their display colors.
  const [initialLoading, setInitialLoading] = useState<boolean>(true); // Overall loading state for the dashboard's initial data.
  const [isStudyHoursLoading, setIsStudyHoursLoading] = useState<boolean>(false); // Loading state specifically for study hours data.

  // State for a new task being added, initialized with empty values.
  const [newTask, setNewTask] = useState<{
    title: string;
    category: string;
    deadline: string;
  }>({
    title: '',
    category: '', // Will be set to the first available category after initial fetch.
    deadline: '',
  });

  // Modal State Management:
  const [isModalOpen, setIsModalOpen] = useState(false); // Controls modal visibility.
  // Stores content and actions for the modal.
  const [modalContent, setModalContent] = useState({ title: '', message: '', isConfirm: false, onConfirm: () => {} });

  // Memoized callback to open the modal with specific content.
  const openModal = useCallback((title: string, message: string, isConfirm: boolean = false, onConfirm: () => void = () => {}) => {
    setModalContent({ title, message, isConfirm, onConfirm });
    setIsModalOpen(true);
  }, []); // Dependencies: none, as it only sets state.

  // Memoized callback to close the modal.
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []); // Dependencies: none.


  // --- Initial Data Fetching Effect ---
  // This useEffect runs once when the component mounts to fetch all initial dashboard data.
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setInitialLoading(true); // Start the overall loading indicator.

        // Fetch user info, preferences (subjects/colors), and tasks concurrently using Promise.all.
        const [userRes, prefRes, taskRes] = await Promise.all([
          fetch('/api/login'), // API endpoint to get user details (assuming it returns name).
          fetch('/api/user/preferences'), // API for subjects and colors.
          fetch('/api/user/tasks'), // API for user tasks and categories.
        ]);

        // Process user data response.
        const userData = await userRes.json();
        if (!userRes.ok || !userData.name) {
          throw new Error(userData.message || 'Failed to fetch user data. Please log in again.');
        }
        setUserName(userData.name); // Set the user's name.

        // Process preferences data.
        const prefData = await prefRes.json();
        if (!prefRes.ok || !Array.isArray(prefData.subjects) || typeof prefData.subjectcolors !== 'object') {
          throw new Error(prefData.message || 'Failed to load preferences.');
        }
        setSubjects(prefData.subjects); // Set the list of subjects.
        setSubjectColorsMap(prefData.subjectcolors); // Set the subject-color mapping.

        // Process tasks and categories data.
        const taskData = await taskRes.json();
        if (!taskRes.ok) {
          throw new Error(taskData.message || 'Failed to load tasks.');
        }
        setTasks(taskData.tasks || []); // Set the list of tasks.
        // Ensure fetched categories are an array of strings.
        const fetchedCategories: string[] = Array.isArray(taskData.category) ? taskData.category : [];
        setCategories(fetchedCategories); // Set the list of task categories.

        // Set the default category for the 'newTask' form if categories are available.
        setNewTask((prev) => ({
          ...prev,
          category: fetchedCategories.length > 0 ? fetchedCategories[0] : '',
        }));

      } catch (err: any) {
        console.error('Error loading dashboard initial data:', err); // Log the error for debugging.
        // Display an error modal and redirect to login if initial data fetch fails.
        openModal('Error', `Error: ${err.message}. Redirecting to login.`);
        router.push('/'); // Redirect to the login page.
      } finally {
        setInitialLoading(false); // End the overall loading indicator.
      }
    };

    fetchInitialData(); // Call the async function to start data fetching.
  }, [router, openModal]); // Dependencies: router (for push) and openModal (for error handling).

  // --- Study Hours Data Fetching Effect ---
  // This useEffect runs whenever the 'selectedDate' changes to load study hours for that specific day.
  useEffect(() => {
    const fetchStudyHours = async () => {
      try {
        setIsStudyHoursLoading(true); // Start loading indicator for study hours.

        // Fetch study hours data for the currently selected date.
        const studyRes = await fetch(`/api/user/study-hours?date=${selectedDate}`);
        const studyData = await studyRes.json();

        if (!studyRes.ok || typeof studyData.studyData !== 'object') {
          throw new Error(studyData.message || 'Failed to load study time.');
        }

        // Extract the study data specifically for the `selectedDate` from the overall `studyData`.
        const dailyStudyData = studyData.studyData[selectedDate];

        const parsedStudyHours: StudyHours = {};
        if (dailyStudyData && typeof dailyStudyData === 'object') {
          // Iterate over subjects within the daily data and populate `parsedStudyHours`.
          for (const subject in dailyStudyData) {
            if (Object.prototype.hasOwnProperty.call(dailyStudyData, subject)) {
              parsedStudyHours[subject] = Number(dailyStudyData[subject]);
            }
          }
        }

        setStudyHours(parsedStudyHours || {}); // Update study hours state.

      } catch (err: any) {
        console.error('Error loading study hours:', err); // Log the error.
        setStudyHours({}); // Clear study hours on error.
        openModal('Error', `Failed to load study hours: ${err.message}`); // Display error modal.
      } finally {
        setIsStudyHoursLoading(false); // End loading indicator for study hours.
      }
    };

    fetchStudyHours(); // Call the async function to fetch study hours.
  }, [selectedDate, openModal]); // Dependencies: selectedDate (to re-fetch on date change) and openModal (for errors).

  // --- Memoized Chart Data ---
  // Memoized list of subjects that have logged study hours for the selected date.
  const studiedSubjects = useMemo(() => Object.keys(studyHours).filter(subject => studyHours[subject] > 0), [studyHours]);

  // Memoized data configuration for the daily study time bar chart.
  const barDataDaily = useMemo(() => ({
    labels: studiedSubjects.map((s) => s.charAt(0).toUpperCase() + s.slice(1)), // Capitalize subject names for display.
    datasets: [
      {
        label: 'Study Hours',
        data: studiedSubjects.map((subject) => studyHours[subject]), // Hours data for each subject.
        backgroundColor: studiedSubjects.map((subject) => subjectColorsMap[subject] || '#CCCCCC'), // Subject-specific colors.
        borderColor: studiedSubjects.map((subject) => subjectColorsMap[subject] ? subjectColorsMap[subject].replace('1)', '0.8)') : '#AAAAAA'), // Slightly darker border color.
        borderWidth: 1,
      },
    ],
  }), [studiedSubjects, studyHours, subjectColorsMap]); // Dependencies for this memoization.

  // Memoized data configuration for the subject-wise time allocation doughnut chart.
  const doughnutData = useMemo(() => ({
    labels: studiedSubjects, // Subject names for chart labels.
    datasets: [
      {
        label: 'Hours Spent',
        data: studiedSubjects.map((subject) => studyHours[subject]), // Hours data.
        backgroundColor: studiedSubjects.map((subject) => subjectColorsMap[subject] || '#CCCCCC'), // Subject-specific colors.
        borderColor: '#FFFFFF', // White border for segments.
        borderWidth: 1,
      },
    ],
  }), [studiedSubjects, studyHours, subjectColorsMap]); // Dependencies for this memoization.

  // --- Task Management Functions ---
  // Memoized function to determine the status of a task (Completed, Overdue, On Time).
  const getTaskStatus = useCallback((deadline: string, completed: boolean) => {
    if (completed) return 'Completed'; // If task is completed, status is 'Completed'.
    const now = new Date();
    const due = new Date(deadline);
    if (due < now) return 'Overdue'; // If deadline has passed, status is 'Overdue'.
    return 'On Time'; // Otherwise, status is 'On Time'.
  }, []); // No dependencies, as it only uses function parameters.

  // Memoized function to get Tailwind CSS classes for task status styling.
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'On Time':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Overdue':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'Completed':
        return 'bg-green-100 text-green-700 border-green-300 line-through'; // Add line-through for completed tasks.
      default:
        return '';
    }
  }, []); // No dependencies.

  // Memoized function to toggle a task's completion status.
  const toggleComplete = useCallback(async (id: number) => {
    // Create a new array with the toggled task's completed status.
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks); // Optimistically update the UI.

    try {
      // Send a POST request to update tasks on the backend.
      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks, category: categories }), // Send updated tasks and categories.
      });
      if (!res.ok) {
        setTasks(tasks); // Revert UI on error.
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update task status.');
      }
    } catch (err: any) {
      console.error('Error updating task status:', err); // Log error.
      openModal('Error', `Error updating task status: ${err.message}`); // Display error modal.
    }
  }, [tasks, categories, openModal]); // Dependencies: tasks (for mapping), categories (for payload), openModal.

  // Memoized function to add a new task.
  const handleAddTask = useCallback(async () => {
    // Validate required fields for a new task.
    if (!newTask.title.trim() || !newTask.deadline || !newTask.category) {
      openModal('Missing Information', 'Please fill in all task fields: Title, Category, and Deadline.');
      return;
    }

    // Generate a new unique ID for the task.
    const nextId = Math.max(0, ...tasks.map((t) => t.id || 0)) + 1;
    // Create the new task object.
    const taskToAdd: Task = { ...newTask, id: nextId, completed: false };
    // Add the new task to the existing tasks array.
    const updatedTasks = [...tasks, taskToAdd];
    setTasks(updatedTasks); // Optimistically update UI.
    // Reset the new task form, defaulting category to the first available if possible.
    setNewTask({ title: '', category: categories[0] || '', deadline: '' });

    try {
      // Send a POST request to update tasks on the backend.
      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks, category: categories }), // Send updated tasks and categories.
      });
      if (!res.ok) {
        setTasks(tasks); // Revert UI on error.
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save task.');
      }
    } catch (err: any) {
      console.error('Error adding task:', err); // Log error.
      openModal('Error', `Error adding task: ${err.message}`); // Display error modal.
    }
  }, [newTask, tasks, categories, openModal]); // Dependencies: newTask, tasks, categories, openModal.

  // Memoized function to add a new task category.
  const handleAddCategory = useCallback(async () => {
    const trimmedCategory = newCategory.trim().toLowerCase(); // Sanitize and normalize new category name.
    if (!trimmedCategory) {
      openModal('Invalid Input', 'Category name cannot be empty.');
      return;
    }
    if (categories.includes(trimmedCategory)) {
      openModal('Duplicate Category', 'Category already exists.');
      return;
    }

    const updatedCategories = [...categories, trimmedCategory]; // Add new category.
    setCategories(updatedCategories); // Optimistically update UI.
    setNewCategory(''); // Clear the new category input field.

    try {
      // Send a POST request to update tasks/categories on the backend.
      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, category: updatedCategories }), // Send current tasks and updated categories.
      });
      if (!res.ok) {
        setCategories(categories); // Revert UI on error.
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save category.');
      }
      // If this is the first category added, or newTask category is empty, set it as default for newTask.
      if (newTask.category === '' && updatedCategories.length === 1) {
          setNewTask(prev => ({ ...prev, category: updatedCategories[0] }));
      }
    } catch (err: any) {
      console.error('Error adding category:', err); // Log error.
      openModal('Error', `Error adding category: ${err.message}`); // Display error modal.
    }
  }, [newCategory, categories, tasks, newTask.category, openModal]); // Dependencies: newCategory, categories, tasks, newTask.category, openModal.

  // Memoized function to delete a selected task category.
  const handleDeleteCategory = useCallback(() => {
    if (!selectedCategoryToDelete) {
      openModal('No Selection', 'Please select a category to delete.');
      return;
    }

    // Open a confirmation modal before proceeding with deletion.
    openModal(
      'Confirm Deletion',
      `Are you sure you want to delete the category "${selectedCategoryToDelete}"? Tasks assigned to this category will remain, but the category itself will be removed from future selections.`,
      true, // This is a confirmation modal.
      async () => { // Callback function to execute on confirmation.
        const payload = {
          categoryToDelete: selectedCategoryToDelete,
        };

        try {
          // Send a PATCH request to delete the category on the backend.
          const response = await fetch('/api/user/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(responseData.error || 'Failed to delete category');
          }

          // Update the categories state by filtering out the deleted category.
          setCategories((prev) => prev.filter((cat) => cat !== selectedCategoryToDelete));
          setSelectedCategoryToDelete(''); // Reset the selection.
          // If the deleted category was the one selected for new task, reset it to the first available.
          if (newTask.category === selectedCategoryToDelete) {
              setNewTask(prev => ({ ...prev, category: categories.filter(c => c !== selectedCategoryToDelete)[0] || '' }));
          }
        } catch (error: any) {
          console.error('Error deleting category:', error); // Log error.
          openModal('Error', `Failed to delete category: ${error.message}`); // Display error modal.
        }
      }
    );
  }, [selectedCategoryToDelete, categories, newTask.category, openModal]); // Dependencies for this callback.


  // Memoized function to handle user logout.
  const handleLogout = useCallback(async () => {
    try {
      // Send a POST request to the logout API endpoint.
      const res = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin', // Ensure cookies are sent correctly.
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Logout failed.');
      }
    } catch (err: any) {
      console.error('Logout error:', err); // Log error.
      openModal('Logout Failed', `Logout failed: ${err.message}`); // Display error modal.
    } finally {
      router.replace('/'); // Always redirect to the homepage/login page after logout attempt.
    }
  }, [router, openModal]); // Dependencies: router and openModal.

  // --- Derived State for Insights (Memoized) ---
  // Calculates total study hours from the 'studyHours' state.
  const totalHours = useMemo(() =>
    Object.values(studyHours).reduce((sum, h) => sum + h, 0).toFixed(1), // Sums all hours and formats to one decimal.
    [studyHours] // Recalculates only when 'studyHours' changes.
  );
  // Counts tasks that are 'On Time' and not yet completed.
  const onTimeTasks = useMemo(() =>
    tasks.filter(t => getTaskStatus(t.deadline, t.completed) === 'On Time' && !t.completed).length,
    [tasks, getTaskStatus] // Recalculates when 'tasks' or 'getTaskStatus' changes.
  );
  // Counts tasks that are 'Overdue' and not yet completed.
  const overdueTasks = useMemo(() =>
    tasks.filter(t => getTaskStatus(t.deadline, t.completed) === 'Overdue' && !t.completed).length,
    [tasks, getTaskStatus] // Recalculates when 'tasks' or 'getTaskStatus' changes.
  );
  // Counts tasks that have been completed.
  const completedTasks = useMemo(() =>
    tasks.filter(t => t.completed).length,
    [tasks] // Recalculates when 'tasks' changes.
  );


  // --- Initial Loading State UI ---
  // Displays a loading message across the screen while the dashboard's initial data is fetched.
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 font-sans">
        <p className="text-xl text-orange-600">Loading dashboard data...</p>
      </div>
    );
  }

  // --- Main Dashboard UI ---
  return (
    // Main container div for the entire dashboard page.
    // `h-screen` makes it take up the full viewport height.
    // `flex flex-col` arranges children vertically.
    // `p-4 sm:p-6 lg:p-8` provides responsive padding.
    <div className="h-screen w-full bg-orange-50 p-4 sm:p-6 lg:p-8 font-sans flex flex-col">
      {/* Modal component, controlled by `isModalOpen` and `modalContent` states. */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={modalContent.title}
        message={modalContent.message}
        isConfirm={modalContent.isConfirm}
        onConfirm={modalContent.onConfirm}
      />

      {/* Header section: Contains welcome message, settings button, and logout button. */}
      {/* `flex justify-between items-center` spreads items horizontally and aligns them vertically. */}
      {/* `flex-wrap gap-y-4` allows items to wrap onto new lines on smaller screens with vertical spacing. */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-y-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-orange-600">Welcome, {userName || 'User'}</h1>
        <div className="flex space-x-2 sm:space-x-4">
          {/* Link to the Settings page. */}
          <Link href="/Settings" className="block">
            <button className="bg-orange-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded-md hover:bg-orange-600 transition text-sm sm:text-base">
              Settings
            </button>
          </Link>
          {/* Logout button. */}
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded-md hover:bg-red-600 transition text-sm sm:text-base"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Grid Container: Arranges the three primary content sections. */}
      {/* `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[2fr_2fr_1fr]` defines responsive column layouts. */}
      {/* `gap-6` adds spacing between grid items. `flex-grow` makes the grid fill available vertical space. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[2fr_2fr_1fr] gap-6 flex-grow">
        {/* Daily Study Time Card */}
        {/* `flex flex-col` stacks content vertically within the card. */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700">Daily Study Time</h2>
            {/* Date input for selecting which day's study hours to view. */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm sm:text-base text-gray-800 max-w-full"
            />
          </div>
          {/* Chart container for the daily study bar graph. */}
          {/* `flex-grow relative flex items-center justify-center` ensures the chart takes available space and is centered. */}
          <div className="flex-grow relative flex items-center justify-center">
            {isStudyHoursLoading ? (
              <p className="text-gray-500 text-sm">Loading study hours...</p>
            ) : studiedSubjects.length > 0 ? (
              <Bar
                data={barDataDaily}
                options={{
                  responsive: true, // Chart resizes with its container.
                  maintainAspectRatio: false, // Allows flexible height.
                  scales: {
                    y: {
                      beginAtZero: true, // Y-axis starts at zero.
                      ticks: { stepSize: 1 }, // Y-axis ticks increment by 1.
                      title: { display: true, text: 'Hours', font: { size: 12 } }, // Y-axis label.
                    },
                    x: {
                        title: { display: true, text: 'Subject', font: { size: 12 } }, // X-axis label.
                    },
                  },
                  plugins: {
                    legend: { display: false }, // Hide legend as data is self-explanatory.
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw} hrs` } } // Custom tooltip format.
                  }
                }}
              />
            ) : (
              <p className="text-gray-400 text-center text-sm sm:text-base flex items-center justify-center h-full">
                No study data for {selectedDate}. Start studying!
              </p>
            )}
          </div>
          {/* Button to navigate to the Study Timer page. */}
          <Link href="/timer" className='block w-full mt-4'>
            <button className="w-full bg-orange-500 text-white py-2 rounded-md hover:bg-orange-600 transition text-sm sm:text-base">
              Start Study Timer
            </button>
          </Link>
        </div>

        {/* Task Manager Card */}
        {/* `flex flex-col` stacks content vertically. */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col">
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Tasks</h2>
          {/* Add Task Form section. */}
          <div className="mb-4 space-y-2">
            <input
              type="text"
              placeholder="Task Name"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full border border-gray-400 rounded px-3 py-1 text-sm text-gray-800"
              required // Task title is mandatory.
            />
            {/* Flex container for the "Add Task" row, ensuring elements wrap responsively. */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="flex-grow w-full sm:w-auto border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
                required // Task category is mandatory.
              >
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)} {/* Capitalize category for display. */}
                    </option>
                  ))
                ) : (
                  <option value="" disabled className="max-w-full truncate text-gray-500">No categories yet. Add below.</option>
                )}
              </select>
              <input
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                className="flex-grow w-full sm:w-auto border border-gray-600 rounded px-2 py-1 text-sm text-gray-800"
                required // Task deadline is mandatory.
              />
              <button
                onClick={handleAddTask}
                className="w-full sm:w-auto bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition flex-shrink-0 text-sm"
              >
                ➕ Add Task
              </button>
            </div>
            {/* Category Management section. */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="New Category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-grow w-full sm:w-auto border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
              />
              <button
                onClick={handleAddCategory}
                className="w-full sm:w-auto bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition flex-shrink-0 text-sm"
              >
                ➕ Add
              </button>
              <select
                value={selectedCategoryToDelete}
                onChange={(e) => setSelectedCategoryToDelete(e.target.value)}
                className="flex-grow w-full sm:w-auto border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
                disabled={categories.length === 0} // Disable if no categories to delete.
              >
                <option value="" disabled>Delete Category</option> {/* Default disabled option. */}
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)} {/* Capitalize category for display. */}
                  </option>
                ))}
              </select>
              <button
                onClick={handleDeleteCategory}
                disabled={!selectedCategoryToDelete} // Disable if no category is selected for deletion.
                className="w-full sm:w-auto bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition disabled:opacity-50 flex-shrink-0 text-sm"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
          {/* Task List display area. */}
          {/* `overflow-y-auto` makes it scrollable if tasks exceed height. `max-h-56` sets a max height. */}
          {/* `flex-grow` allows it to expand vertically within the card. */}
          <div className={`space-y-3 overflow-y-auto pr-2 flex-grow ${tasks.length > 3 ? 'max-h-56' : ''}`}>
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No tasks added yet.</p>
            ) : (
              tasks.map((task) => {
                const status = getTaskStatus(task.deadline, task.completed); // Get task status.
                const colorClass = getStatusColor(status); // Get status-based styling.
                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded border-l-4 pl-4 ${colorClass}`} // Apply border and background colors based on status.
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start flex-grow min-w-0">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleComplete(task.id)} // Toggle completion on click.
                          className="mt-1 mr-2 cursor-pointer h-4 w-4 sm:h-5 sm:w-5 accent-orange-500 flex-shrink-0"
                        />
                        <div className="flex-grow min-w-0">
                          <p className="font-medium text-sm sm:text-base">{task.title}</p>
                          <p className="text-xs sm:text-sm mt-1 text-gray-500">
                            Category: <span className="font-semibold text-gray-700">{task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : 'Uncategorized'}</span> • Due: {task.deadline}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-block text-xs sm:text-sm px-2 py-1 rounded-full border ${colorClass} flex-shrink-0 ml-2`}>
                        {status} {/* Display task status. */}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Contains Subject-wise Allocation and AI Insights cards */}
        {/* `flex flex-col gap-6` stacks children vertically with spacing. */}
        {/* `lg:col-span-1 md:col-span-2` defines how many columns this div spans on different screen sizes. */}
        <div className="flex flex-col gap-6 lg:col-span-1 md:col-span-2">
          {/* Subject-wise Allocation Card */}
          {/* `flex-1` allows this card to grow and shrink proportionally. */}
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col items-center justify-center flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">
              Subject-wise Time Allocation
            </h2>
            {/* Chart container for the Doughnut chart. */}
            <div className="w-full max-w-[250px] h-full flex items-center justify-center">
              {studiedSubjects.length > 0 ? (
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
              ) : (
                <p className="text-gray-400 text-center text-sm sm:text-base">No study hours logged yet.</p>
              )}
            </div>
          </div>
          {/* AI Insights Card */}
          {/* `flex-1` allows this card to grow and shrink proportionally. `justify-between` spaces content top/bottom. */}
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col justify-between flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">🧠 Insights</h2>
            <ul className="space-y-2 text-sm sm:text-base text-gray-700">
              <li>
                📊 <strong>Total Study Hours Today:</strong> {totalHours} hrs
              </li>
              <li>
                ✅ <strong>Completed Tasks:</strong> {completedTasks}
              </li>
              <li>
                ⏳ <strong>On-Time Pending Tasks:</strong> {onTimeTasks}
              </li>
              <li>
                ⚠️ <strong>Overdue Tasks:</strong> {overdueTasks}
              </li>
            </ul>
            <p className="mt-4 text-xs text-gray-500">
              Keep tracking your progress to unlock deeper performance insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
