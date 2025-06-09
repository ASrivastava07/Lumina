'use client';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useRouter } from 'next/navigation';
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

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];
  const router = useRouter();

  // 🔹 All hooks at top level
  const [userName, setUserName] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [studyHours, setStudyHours] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategoryToDelete, setSelectedCategoryToDelete] = useState('');
  const [subjectColorsMap, setSubjectColorsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({
    title: '',
    subject: '', // Will be set dynamically after load
    deadline: '',
  });
  const [newSubject, setNewSubject] = useState('');

  // ✅ Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
          // Fetch logged-in user
        const userRes = await fetch('/api/login');
        const userData = await userRes.json();
        if (!userRes.ok || !userData.name) {
          throw new Error('Failed to fetch user');
        }
        setUserName(userData.name);

        // Fetch user preferences (subjects + colors)
        const prefRes = await fetch('/api/user/preferences');
        const prefData = await prefRes.json();
        if (!prefRes.ok || !prefData.subjects || !prefData.subjectcolors) {
          throw new Error('Failed to load preferences');
        }
        setSubjects(prefData.subjects);
        setSubjectColorsMap(prefData.subjectcolors);
        setNewTask((prev) => ({
          ...prev,
          subject: prefData.subjects[0] || '',
        }));

        // Fetch tasks
        const taskRes = await fetch('/api/user/tasks');
        const taskData = await taskRes.json();
        if (!taskRes.ok) {
          throw new Error('Failed to load tasks');
        }
        setTasks(taskData.tasks || []);

        // fetch categories:
        setCategories(taskData.category || []);

        // Fetch study hours for selected date
        const studyRes = await fetch(`/api/user/study-hours`);
        const studyData = await studyRes.json();
        if (!studyRes.ok || !studyData.studyData) {
          throw new Error('Failed to load study time');
        }
        const dayData = studyData.studyData[selectedDate] || {};
        setStudyHours(dayData);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        alert('Failed to load dashboard data');
        router.push('');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, selectedDate]);


//  Filter out subjects that were actually studied (non-zero hours)
const studiedSubjects = Object.keys(studyHours).filter(subject => studyHours[subject] > 0);

//  Chart data only includes subjects that were actually studied
const barDataDaily = {
  labels: studiedSubjects.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
  datasets: [
    {
      label: 'Study Hours',
      data: studiedSubjects.map((subject) => studyHours[subject]),
      backgroundColor: studiedSubjects.map((subject) => subjectColorsMap[subject]),
    },
  ],
};

// Donut Graph  
const doughnutData = {
  labels: studiedSubjects,
  datasets: [
    {
      label: 'Hours Spent',
      data: studiedSubjects.map((subject) => studyHours[subject]),
      backgroundColor: studiedSubjects.map((subject) => subjectColorsMap[subject]),
      borderWidth: 1,
    },
  ],
};

  // ✅ Task status logic remains
  const toggleComplete = async (id: number) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);
    try {
      await fetch('/api/user/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks, category: categories }),
      });
    } catch (err) {
      console.error(err);
      alert('Could not update task status.');
    }
  };

  const getTaskStatus = (deadline: string, completed: boolean) => {
    if (completed) return 'Completed';
    const now = new Date();
    const due = new Date(deadline);
    if (due < now && !completed) return 'Overdue';
    return 'On Time';
  };

  const getStatusColor = (status: string) => {
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
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !newTask.deadline || !newTask.subject) return;
    const nextId = Math.max(...tasks.map((t) => t.id || 0), 0) + 1;
    const updatedTasks = [...tasks, { ...newTask, id: nextId, completed: false }];
    setTasks(updatedTasks);
    setNewTask({ title: '', subject: subjects.length > 0 ? subjects[0] : '', deadline: '' });
    try {
      await fetch('/api/user/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: updatedTasks, category: categories }),
    });
  } 
    catch (err) {
      console.error(err);
      alert('Could not save task to server.');
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim().toLowerCase();
    if (trimmed && !categories.includes(trimmed)) {
      const updatedCategories = [...categories, trimmed];
      try {
        const res = await fetch('/api/user/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks, category: updatedCategories }),
        });
        if (!res.ok) throw new Error('Failed to save category');
        setCategories(updatedCategories);
        setNewCategory('');
      } 
      catch (err) {
        console.error(err);
        alert('Could not add category.');
      }
    }
  };

  const handleDeleteCategory = async () => {
  if (!selectedCategoryToDelete) return;

  const payload = {
    categoryToDelete: selectedCategoryToDelete
  };
  
  console.log('Sending payload:', payload); // Debug log

  try {
    const response = await fetch('/api/user/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Log the response for debugging
    const responseData = await response.json();
    console.log('Response:', responseData);

    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to delete category');
    }

    // Update local state
    setCategories((prev) =>
      prev.filter((cat) => cat !== selectedCategoryToDelete)
    );
    setSelectedCategoryToDelete('');
  } 
  catch (error) {
    console.error('Error deleting category:', error);
    alert('Failed to delete category');
  }
};

  const handleLogout = () => {
    fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).then(() => {
      router.push('http://localhost:3000');
    });
    
    router.replace('/');
  };

  const totalHours = Object.values(studyHours).reduce((sum, h) => sum + h, 0).toFixed(1);
  const onTimeTasks = tasks.filter(t => getTaskStatus(t.deadline, t.completed) === 'On Time' && !t.completed).length;
  const overdueTasks = tasks.filter(t => getTaskStatus(t.deadline, t.completed) === 'Overdue' && !t.completed).length;
  const completedTasks = tasks.filter(t => t.completed).length;


  // ✅ Show loading screen until data is fetched
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-orange-600">Loading dashboard...</p>
      </div>
    );
  }

  // ✅ Render the same UI structure you've built
  return (
    <div className="min-h-screen w-full bg-orange-50 px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-orange-600">Welcome, {userName || 'User'}</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
        >
          Logout
        </button>
        <div className="flex justify-end">
          <Link href="/Settings" className="block">
            <button className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition">
              Settings
            </button>
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr] gap-6 h-[80vh]">
        {/* Daily Study Time */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Daily Study Time</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800"
            />
          </div>
          <div className="flex-grow relative">
            <Bar
              data={barDataDaily}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 1,
                    },
                  },
                },
              }}
            />
          </div>
          <Link href="/timer" className='block w-full'>
            <button className="w-full mt-4 bg-orange-500 text-white py-2 rounded-md hover:bg-orange-600 transition">
              Start Study Timer
            </button>
          </Link>
        </div>
        {/* Task Manager Card */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col h-full">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Tasks</h2>
          {/* Add Task Form */}
          <div className="mb-4 space-y-2">
            <input
              type="text"
              placeholder="Task Name"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full border border-gray-400 rounded px-3 py-1 text-sm text-gray-800"
            />
            {/* Add New category */}
            
            <div className="flex gap-2">
              <select
                value={newTask.subject}
                onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                className="border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 items-center mt-2">
                <input
                  type="text"
                  placeholder="New Catagory"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
                />
                <button
                  onClick={handleAddCategory}
                  className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition"
                >
                  ➕
                </button>
                <select
                  value={selectedCategoryToDelete}
                  onChange={(e) => setSelectedCategoryToDelete(e.target.value)}
                  className="border border-gray-600 rounded px-3 py-1 text-sm text-gray-800 w-full"
                >
                  <option value="" disabled>Select category to delete</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteCategory}
                  disabled={!selectedCategoryToDelete}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition disabled:opacity-50"
                >
                  🗑️
                </button>

              </div>  
            </div>
            <div className='flex gap-2 items-center mt-2'>
                <input
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                className="border border-gray-600 rounded px-2 py-1 text-sm text-gray-800 text-gray-400"
              />
              <button
                onClick={handleAddTask}
                className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
              >
                ➕ Add Task
              </button>
            </div>
          </div>
          {/* Task List */}
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 flex-grow">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center">No tasks added yet.</p>
            ) : (
              tasks.map((task) => {
                const status = getTaskStatus(task.deadline, task.completed);
                const color = getStatusColor(status);
                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded border-l-4 pl-4 ${color}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleComplete(task.id)}
                          className="mt-1 mr-2 cursor-pointer"
                        />
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs mt-1 text-gray-500">
                            Subject: <span className="font-semibold text-gray-700">{task.subject}</span> • Due: {task.deadline}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-block text-xs px-2 py-1 rounded ${color}`}>
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
        <div className="flex flex-col gap-6 h-full">
          {/* Subject-wise Allocation */}
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col items-center justify-center flex-1">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Subject-wise Time Allocation
            </h2>
            <div className="w-full max-w-[200px] h-full">
              <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
          {/* AI Insights */}
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col justify-between flex-1">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">🧠 Insights</h2>
            <ul className="space-y-2 text-sm text-gray-700">
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