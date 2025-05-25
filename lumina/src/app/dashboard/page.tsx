'use client';

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
  const [selectedDate, setSelectedDate] = useState(today);
  const [studyHours, setStudyHours] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
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
        setTasks(taskData || []);

        // Fetch study hours for selected date
        const studyRes = await fetch(`/api/user/study-hours?date=${selectedDate}`);
        const studyData = await studyRes.json();
        if (!studyRes.ok || !studyData.studyTime) {
          throw new Error('Failed to load study time');
        }
        setStudyHours(studyData.studyTime);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        alert('Failed to load dashboard data');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, selectedDate]);

  // 🚫 Avoid using Hooks conditionally or inside return
  // ❌ Don't do this inside render:
  // const [newSubject, setNewSubject] = useState('');
  // ✅ Already moved to top level

  // ✅ Build chart data only when subjects are loaded
  const barDataDaily = {
    labels: subjects.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [
      {
        label: 'Study Hours',
        data: subjects.map((subject) => studyHours[subject] || 0),
        backgroundColor: subjects.map((subject) => subjectColorsMap[subject]),
      },
    ],
  };

  // ✅ Build doughnut chart data
  const doughnutData = {
    labels: subjects,
    datasets: [
      {
        label: 'Time Spent',
        data: subjects.map((subject) => studyHours[subject] || 0),
        backgroundColor: subjects.map((subject) => subjectColorsMap[subject]),
        borderWidth: 1,
      },
    ],
  };

  // ✅ Task status logic remains
  const toggleComplete = (id: number) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
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

  const handleAddTask = () => {
    if (!newTask.title.trim() || !newTask.deadline || !newTask.subject) return;
    const nextId = Math.max(...tasks.map((t) => t.id), 0) + 1;
    setTasks([...tasks, { ...newTask, id: nextId }]);
    setNewTask({ title: '', subject: subjects.length > 0 ? subjects[0] : '', deadline: '' });
  };

  const handleAddSubject = () => {
    const trimmed = newSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setNewSubject('');
    }
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).then(() => {
      router.push('/login');
    });
  };

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
        <h1 className="text-2xl font-semibold text-orange-600">Welcome, Jeff</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
        >
          Logout
        </button>
        <button className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-600 font-semibold transition">
          Settings
        </button>
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
          <button className="mt-4 bg-orange-500 text-white py-2 rounded-md hover:bg-orange-600 transition">
            Start Study Timer
          </button>
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
            <div className="flex gap-2">
              <select
                value={newTask.subject}
                onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                className="border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject.charAt(0).toUpperCase() + subject.slice(1)}
                  </option>
                ))}
              </select>
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
            {/* Add New Subject */}
            <div className="flex gap-2 items-center mt-2">
              <input
                type="text"
                placeholder="New Subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
              />
              <button
                onClick={handleAddSubject}
                className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition"
              >
                ➕
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
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col justify-center flex-1">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">AI Insights</h2>
            <p className="text-sm text-gray-800 text-gray-500">
              You haven’t started studying yet. Begin your first session to get insights!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}