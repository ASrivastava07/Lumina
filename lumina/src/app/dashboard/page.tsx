// app/dashboard.tsx (or pages/dashboard.tsx)
'use client';

import Link from 'next/link';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useRouter } from 'next/navigation'; // For App Router. Use 'next/router' for Pages Router.

// Register Chart.js components once
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

// Define types for better type safety
interface Task {
  id: number;
  title: string;
  category: string; // Renamed from 'subject' for clarity in tasks
  deadline: string;
  completed: boolean;
}

interface StudyHours {
  [subject: string]: number;
}

interface SubjectColorsMap {
  [subject: string]: string;
}

export default function Dashboard() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  // State Declarations - All hooks at top level
  const [userName, setUserName] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [studyHours, setStudyHours] = useState<StudyHours>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]); // These are study subjects for charts/timer
  const [categories, setCategories] = useState<string[]>([]); // These are for task categories
  const [newCategory, setNewCategory] = useState<string>('');
  const [selectedCategoryToDelete, setSelectedCategoryToDelete] = useState<string>('');
  const [subjectColorsMap, setSubjectColorsMap] = useState<SubjectColorsMap>({});
  const [initialLoading, setInitialLoading] = useState<boolean>(true); // For initial full dashboard load
  const [isStudyHoursLoading, setIsStudyHoursLoading] = useState<boolean>(false); // For specific study hours reload

  const [newTask, setNewTask] = useState<{
    title: string;
    category: string; // Changed to category for tasks
    deadline: string;
  }>({
    title: '',
    category: '', // Initialize with empty string, will be set in useEffect
    deadline: '',
  });

  // --- Initial Data Fetching Effect (runs once on mount) ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setInitialLoading(true);

        // Fetch user, preferences (subjects/colors), tasks, and categories concurrently
        const [userRes, prefRes, taskRes] = await Promise.all([
          fetch('/api/login'),
          fetch('/api/user/preferences'),
          fetch('/api/user/tasks'),
        ]);

        // Handle user data
        const userData = await userRes.json();
        if (!userRes.ok || !userData.name) {
          throw new Error(userData.message || 'Failed to fetch user data. Please log in again.');
        }
        setUserName(userData.name);

        // Handle preferences (subjects + colors)
        const prefData = await prefRes.json();
        if (!prefRes.ok || !Array.isArray(prefData.subjects) || typeof prefData.subjectcolors !== 'object') {
          throw new Error(prefData.message || 'Failed to load preferences.');
        }
        setSubjects(prefData.subjects);
        setSubjectColorsMap(prefData.subjectcolors);

        // Handle tasks and categories
        const taskData = await taskRes.json();
        if (!taskRes.ok) {
          throw new Error(taskData.message || 'Failed to load tasks.');
        }
        setTasks(taskData.tasks || []);
        // Assuming categories are part of taskData, update state accordingly
        // Ensure categories are treated as an array of strings
        const fetchedCategories: string[] = Array.isArray(taskData.category) ? taskData.category : [];
        setCategories(fetchedCategories);

        // Set initial category for new task if categories exist
        setNewTask((prev) => ({
          ...prev,
          category: fetchedCategories.length > 0 ? fetchedCategories[0] : '',
        }));

      } catch (err: any) {
        console.error('Error loading dashboard initial data:', err);
        alert(`Error: ${err.message}. Redirecting to login.`);
        router.push('/'); // Redirect to home/login on critical data fetch failure
      } finally {
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [router]); // Only run once on mount

  // --- Study Hours Data Fetching Effect (runs when selectedDate changes) ---
  useEffect(() => {
    const fetchStudyHours = async () => {
      try {
        setIsStudyHoursLoading(true); // Set loading for study hours section

        const studyRes = await fetch(`/api/user/study-hours?date=${selectedDate}`); // Pass selectedDate as query param
        const studyData = await studyRes.json();

        if (!studyRes.ok || typeof studyData.studyData !== 'object') {
          throw new Error(studyData.message || 'Failed to load study time.');
        }

        // ⭐ MODIFIED SECTION STARTS HERE ⭐
        // Get the study data specifically for the selected date
        const dailyStudyData = studyData.studyData[selectedDate];

        const parsedStudyHours: StudyHours = {};
        if (dailyStudyData && typeof dailyStudyData === 'object') {
          // Now iterate over the subjects for the selected date
          for (const subject in dailyStudyData) {
            if (Object.prototype.hasOwnProperty.call(dailyStudyData, subject)) {
              parsedStudyHours[subject] = Number(dailyStudyData[subject]);
            }
          }
        }
        // ⭐ MODIFIED SECTION ENDS HERE ⭐

        setStudyHours(parsedStudyHours || {});

      } catch (err: any) {
        console.error('Error loading study hours:', err);
        setStudyHours({}); // Clear previous study data on error
      } finally {
        setIsStudyHoursLoading(false); // End loading for study hours section
      }
    };

    fetchStudyHours();
  }, [selectedDate]); // Re-fetch only when selectedDate changes

  // --- Memoized Chart Data ---
  const studiedSubjects = useMemo(() => Object.keys(studyHours).filter(subject => studyHours[subject] > 0), [studyHours]);

  const barDataDaily = useMemo(() => ({
    labels: studiedSubjects.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [
      {
        label: 'Study Hours',
        data: studiedSubjects.map((subject) => studyHours[subject]),
        backgroundColor: studiedSubjects.map((subject) => subjectColorsMap[subject] || '#CCCCCC'),
        borderColor: studiedSubjects.map((subject) => subjectColorsMap[subject] ? subjectColorsMap[subject].replace('1)', '0.8)') : '#AAAAAA'),
        borderWidth: 1,
      },
    ],
  }), [studiedSubjects, studyHours, subjectColorsMap]);

  const doughnutData = useMemo(() => ({
    labels: studiedSubjects,
    datasets: [
      {
        label: 'Hours Spent',
        data: studiedSubjects.map((subject) => studyHours[subject]),
        backgroundColor: studiedSubjects.map((subject) => subjectColorsMap[subject] || '#CCCCCC'),
        borderColor: '#FFFFFF',
        borderWidth: 1,
      },
    ],
  }), [studiedSubjects, studyHours, subjectColorsMap]);

  // --- Task Management Functions ---
  const getTaskStatus = useCallback((deadline: string, completed: boolean) => {
    if (completed) return 'Completed';
    const now = new Date();
    const due = new Date(deadline);
    if (due < now) return 'Overdue';
    return 'On Time';
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'On Time':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Overdue':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'Completed':
        return 'bg-green-100 text-green-700 border-green-300 line-through';
      default:
        return '';
    }
  }, []);

  const toggleComplete = useCallback(async (id: number) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);

    try {
      const res = await fetch('/api/user/tasks', {
        method: 'POST', // Assuming POST updates the whole tasks array
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks, category: categories }), // Send updated tasks and current categories
      });
      if (!res.ok) {
        setTasks(tasks); // Revert to previous state
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update task status.');
      }
    } catch (err: any) {
      console.error('Error updating task status:', err);
      alert(`Error: ${err.message}`);
    }
  }, [tasks, categories]);

  const handleAddTask = useCallback(async () => {
    if (!newTask.title.trim() || !newTask.deadline || !newTask.category) { // Check newTask.category
      alert('Please fill in all task fields: Title, Category, and Deadline.');
      return;
    }

    const nextId = Math.max(0, ...tasks.map((t) => t.id || 0)) + 1;
    const taskToAdd: Task = { ...newTask, id: nextId, completed: false };
    const updatedTasks = [...tasks, taskToAdd];
    setTasks(updatedTasks);
    // Reset newTask, ensuring category defaults to first available
    setNewTask({ title: '', category: categories[0] || '', deadline: '' });

    try {
      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks, category: categories }),
      });
      if (!res.ok) {
        setTasks(tasks);
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save task.');
      }
    } catch (err: any) {
      console.error('Error adding task:', err);
      alert(`Error: ${err.message}`);
    }
  }, [newTask, tasks, categories]);

  const handleAddCategory = useCallback(async () => {
    const trimmedCategory = newCategory.trim().toLowerCase();
    if (!trimmedCategory) {
      alert('Category name cannot be empty.');
      return;
    }
    if (categories.includes(trimmedCategory)) {
      alert('Category already exists.');
      return;
    }

    const updatedCategories = [...categories, trimmedCategory];
    setCategories(updatedCategories);
    setNewCategory('');

    try {
      const res = await fetch('/api/user/tasks', {
        method: 'POST', // Assuming POST endpoint for tasks also handles category updates
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, category: updatedCategories }),
      });
      if (!res.ok) {
        setCategories(categories);
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save category.');
      }
      // Update new task category default if this is the first category added
      if (newTask.category === '' && updatedCategories.length === 1) {
          setNewTask(prev => ({ ...prev, category: updatedCategories[0] }));
      }
    } catch (err: any) {
      console.error('Error adding category:', err);
      alert(`Error: ${err.message}`);
    }
  }, [newCategory, categories, tasks, newTask.category]);

  const handleDeleteCategory = useCallback(async () => {
    if (!selectedCategoryToDelete) {
      alert('Please select a category to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete the category "${selectedCategoryToDelete}"? Tasks assigned to this category will remain, but the category itself will be removed from future selections.`)) {
        return;
    }

    const payload = {
      categoryToDelete: selectedCategoryToDelete,
    };

    try {
      const response = await fetch('/api/user/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete category');
      }

      setCategories((prev) => prev.filter((cat) => cat !== selectedCategoryToDelete));
      setSelectedCategoryToDelete(''); // Reset selection
      // If the deleted category was the one selected for new task, reset it
      if (newTask.category === selectedCategoryToDelete) {
          setNewTask(prev => ({ ...prev, category: categories.filter(c => c !== selectedCategoryToDelete)[0] || '' }));
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(`Failed to delete category: ${error.message}`);
    }
  }, [selectedCategoryToDelete, categories, newTask.category]);


  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Logout failed.');
      }
    } catch (err: any) {
      console.error('Logout error:', err);
      alert(`Logout failed: ${err.message}`);
    } finally {
      router.replace('/');
    }
  }, [router]);

  // --- Derived State for Insights (Memoized) ---
  const totalHours = useMemo(() =>
    Object.values(studyHours).reduce((sum, h) => sum + h, 0).toFixed(1),
    [studyHours]
  );
  const onTimeTasks = useMemo(() =>
    tasks.filter(t => getTaskStatus(t.deadline, t.completed) === 'On Time' && !t.completed).length,
    [tasks, getTaskStatus]
  );
  const overdueTasks = useMemo(() =>
    tasks.filter(t => getTaskStatus(t.deadline, t.completed) === 'Overdue' && !t.completed).length,
    [tasks, getTaskStatus]
  );
  const completedTasks = useMemo(() =>
    tasks.filter(t => t.completed).length,
    [tasks]
  );


  // --- Initial Loading State UI ---
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-xl text-orange-600">Loading dashboard data...</p>
      </div>
    );
  }

  // --- Main Dashboard UI ---
  return (
    <div className="min-h-screen w-full bg-orange-50 px-4 py-6 md:px-8 lg:px-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-orange-600">Welcome, {userName || 'User'}</h1>
        <div className="flex space-x-2 sm:space-x-4">
          <Link href="/Settings" className="block">
            <button className="bg-orange-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded-md hover:bg-orange-600 transition text-sm sm:text-base">
              Settings
            </button>
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded-md hover:bg-red-600 transition text-sm sm:text-base"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr] gap-6 h-[calc(100vh-100px)]"> {/* Adjusted height */}
        {/* Daily Study Time */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700">Daily Study Time</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm sm:text-base text-gray-800"
            />
          </div>
          <div className="flex-grow relative flex items-center justify-center">
            {isStudyHoursLoading ? (
              <p className="text-gray-500 text-sm">Loading study hours...</p>
            ) : studiedSubjects.length > 0 ? (
              <Bar
                data={barDataDaily}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { stepSize: 1 },
                      title: { display: true, text: 'Hours', font: { size: 12 } },
                    },
                    x: {
                        title: { display: true, text: 'Subject', font: { size: 12 } },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw} hrs` } }
                  }
                }}
              />
            ) : (
              <p className="text-gray-400 text-center text-sm sm:text-base flex items-center justify-center h-full">
                No study data for {selectedDate}. Start studying!
              </p>
            )}
          </div>
          <Link href="/timer" className='block w-full mt-4'>
            <button className="w-full bg-orange-500 text-white py-2 rounded-md hover:bg-orange-600 transition text-sm sm:text-base">
              Start Study Timer
            </button>
          </Link>
        </div>

        {/* Task Manager Card */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col">
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Tasks</h2>
          {/* Add Task Form */}
          <div className="mb-4 space-y-2">
            <input
              type="text"
              placeholder="Task Name"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full border border-gray-400 rounded px-3 py-1 text-sm text-gray-800"
              required
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={newTask.category} // Now uses newTask.category
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="flex-grow border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
                required
              >
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)} {/* Capitalize for display */}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No categories yet. Add below.</option>
                )}
              </select>
              <input
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                className="border border-gray-600 rounded px-2 py-1 text-sm text-gray-800 flex-grow"
                required
              />
              <button
                onClick={handleAddTask}
                className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition flex-shrink-0 text-sm"
              >
                ➕ Add Task
              </button>
            </div>
            {/* Category Management */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="New Category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-grow border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
              />
              <button
                onClick={handleAddCategory}
                className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition flex-shrink-0 text-sm"
              >
                ➕ Add
              </button>
              <select
                value={selectedCategoryToDelete}
                onChange={(e) => setSelectedCategoryToDelete(e.target.value)}
                className="flex-grow border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
                disabled={categories.length === 0}
              >
                <option value="" disabled>Delete Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleDeleteCategory}
                disabled={!selectedCategoryToDelete}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition disabled:opacity-50 flex-shrink-0 text-sm"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
          {/* Task List */}
          <div className="space-y-3 overflow-y-auto pr-2 flex-grow">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No tasks added yet.</p>
            ) : (
              tasks.map((task) => {
                const status = getTaskStatus(task.deadline, task.completed);
                const colorClass = getStatusColor(status);
                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded border-l-4 pl-4 ${colorClass}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start flex-grow min-w-0"> {/* flex-grow min-w-0 for text wrapping */}
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleComplete(task.id)}
                          className="mt-1 mr-2 cursor-pointer h-4 w-4 sm:h-5 sm:w-5 accent-orange-500 flex-shrink-0"
                        />
                        <div className="flex-grow min-w-0"> {/* flex-grow min-w-0 for text wrapping */}
                          <p className="font-medium text-sm sm:text-base truncate">{task.title}</p>
                          <p className="text-xs sm:text-sm mt-1 text-gray-500">
                            Category: <span className="font-semibold text-gray-700">{task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : 'Uncategorized'}</span> • Due: {task.deadline}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-block text-xs sm:text-sm px-2 py-1 rounded-full border ${colorClass} flex-shrink-0 ml-2`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Subject-wise Allocation & AI Insights */}
        <div className="flex flex-col gap-6">
          {/* Subject-wise Allocation */}
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col items-center justify-center flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">
              Subject-wise Time Allocation
            </h2>
            <div className="w-full max-w-[200px] h-full flex items-center justify-center">
              {studiedSubjects.length > 0 ? (
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
              ) : (
                <p className="text-gray-400 text-center text-sm sm:text-base">No study hours logged yet.</p>
              )}
            </div>
          </div>
          {/* AI Insights */}
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