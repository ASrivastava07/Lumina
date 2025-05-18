'use client';

import React, { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
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

// Default subject list
const defaultSubjects = ['Maths', 'Physics', 'English'];
const subjectColorsMap = {
  Maths: '#f97316',
  Physics: '#3b82f6',
  English: '#10b981',
};

// Dummy daily study data per subject
const dailyStudyData = {
  '2025-05-16': [3, 4, 1],
  '2025-05-17': [2, 3, 1],
  '2025-05-18': [2, 3, 4],
};



export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedDate, setSelectedDate] = useState(today);
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: 'Complete Math Chapter 5',
      subject: 'Maths',
      deadline: '2025-05-20',
      completed: false,
    },
    {
      id: 2,
      title: 'Finish Physics Lab Report',
      subject: 'Physics',
      deadline: '2025-05-15',
      completed: false,
    },
    {
      id: 3,
      title: 'Write English Essay',
      subject: 'English',
      deadline: '2025-05-10',
      completed: true,
    },
    {
      id: 4,
      title: 'Review History Notes',
      subject: 'History',
      deadline: '2025-05-18',
      completed: false,
    },
  ]);

  const [subjects, setSubjects] = useState(defaultSubjects);
  const [newSubject, setNewSubject] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    subject: defaultSubjects[0],
    deadline: '',
  });

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const studyHours = dailyStudyData[selectedDate] || [0, 0, 0];

  const barDataDaily = {
    labels: defaultSubjects,
    datasets: [
      {
        label: 'Study Hours',
        data: studyHours,
        backgroundColor: defaultSubjects.map((s) => subjectColorsMap[s]),
      },
    ],
  };


  const doughnutData = {
    labels: ['No data'],
    datasets: [
      {
        data: [1],
        backgroundColor: ['#d1d5db'],
        borderWidth: 1,
      },
    ],
  };

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
    if (!newTask.title.trim() || !newTask.deadline) return;
    const nextId = Math.max(...tasks.map((t) => t.id), 0) + 1;
    setTasks([...tasks, { ...newTask, id: nextId }]);
    setNewTask({ title: '', subject: defaultSubjects[0], deadline: '' });
  };

  const handleAddSubject = () => {
    const trimmed = newTask.subject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
    }
  };

  return (
    <div className="min-h-screen w-full bg-orange-50 px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-orange-600">Welcome, Emily</h1>
        <button className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition">Settings</button>
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
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 text-gray-600"
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
              onChange={(e) =>
                setNewTask({ ...newTask, title: e.target.value })
              }
              className="w-full border border-gray-400 rounded px-3 py-1 text-sm text-gray-800"
            />

            <div className="flex gap-2">
              <select
                value={newTask.subject}
                onChange={(e) =>
                  setNewTask({ ...newTask, subject: e.target.value })
                }
                className="border border-gray-600 rounded px-3 py-1 text-sm text-gray-800"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={newTask.deadline}
                onChange={(e) =>
                  setNewTask({ ...newTask, deadline: e.target.value })
                }
                className="border border-gray-600 rounded px-2 py-1 text-sm text-gray-800 text-gray-400"
              />

              <button
                onClick={handleAddTask}
                className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
              >
                Add Task
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
                onClick={() => {
                  const trimmed = newSubject.trim();
                  if (trimmed && !subjects.includes(trimmed)) {
                    setSubjects([...subjects, trimmed]);
                    setNewSubject('');
                  }
                }}
                className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition"
              >
                ➕
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 flex-grow">
            {tasks.length === 0 && (
              <p className="text-gray-400 text-sm text-gray-800 text-center">No tasks added yet.</p>
            )}

            {tasks.map((task) => {
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
            })}
          </div>
        </div>

        {/* Right Column: Subject-wise and AI stacked */}
        <div className="flex flex-col gap-6 h-full">
          {/* Subject-wise Allocation */}
          <div className="bg-white rounded-2xl p-4 shadow-md flex flex-col items-center justify-center flex-1">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Subject-wise Time Allocation</h2>
            <div className="w-full max-w-[200px] h-full">
              <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
            <p className="text-sm text-gray-800 text-gray-400 mt-4">No data yet</p>
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