'use client';

import Link from 'next/link';
import React, { useEffect, useState, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const TimerPage = () => {
  const [mode, setMode] = useState<'pomodoro' | 'reversePomodoro' | 'stopwatch' | 'custom' >('pomodoro');
  const [timeLeft, setTimeLeft] = useState(1500);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectColors, setSubjectColors] = useState<{ [key: string]: string }>({});
  const [newSubject, setNewSubject] = useState('');
  const [newColor, setNewColor] = useState('#f97316');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/user/preferences')
      .then(res => res.json())
      .then(data => {
        setSubjects(data.subjects || []);
        setSubjectColors(data.subjectcolors || {});
        if (!subject && data.subjects.length > 0) {
          setSubject(data.subjects[0]);
        }
      });
  }, []);

  const presets = {
    pomodoro: 25 * 60,
    reversePomodoro: 5 * 60,
  };

  useEffect(() => {
    if (!timerRunning && !onBreak) {
      if (mode === 'pomodoro') setTimeLeft(presets.pomodoro);
      else if (mode === 'reversePomodoro') setTimeLeft(presets.reversePomodoro);
      else if (mode === 'custom') setTimeLeft(Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60));
      else setTimeLeft(0);
    }
  }, [mode, customMinutes, timerRunning]);

const handleStart = () => {
  if (!subject) return alert('Please select a subject');

  const duration =
    mode === 'stopwatch' ? 0 :
    mode === 'custom' ? Math.min(parseInt(customMinutes) * 60, 180 * 60) :
    presets[mode];

  if (mode === 'custom' && duration <= 0) return alert('Invalid custom time');

  setTimerRunning(true);
  setOnBreak(false);
  setTimeLeft(duration);
  setStopwatchSeconds(0);

  intervalRef.current = setInterval(() => {
    setTimeLeft(prev => {
      if (mode === 'stopwatch') {
        setStopwatchSeconds(s => s + 1);
        return prev + 1;
      }

      if (prev > 1) return prev - 1;

      clearInterval(intervalRef.current!);

      let totalStudyTime = 0;
        switch (mode) {
          case 'stopwatch':
            totalStudyTime = stopwatchSeconds;
            break;
          case 'custom':
            totalStudyTime = duration;
            break;
          case 'pomodoro':
          case 'reversePomodoro':
            totalStudyTime = presets[mode];
            break;
        }

      const breakDuration = Math.floor(mode === 'pomodoro' || mode === 'reversePomodoro' ? 5 * 60 : totalStudyTime / 3);
      setBreakTimeLeft(breakDuration);
      setOnBreak(true);
      return 0;
    });
  }, 1000);
};


  const handleBreak = () => {
    intervalRef.current = setInterval(() => {
      setBreakTimeLeft(prev => {
        if (prev > 1) return prev - 1;
        clearInterval(intervalRef.current!);
        setOnBreak(false);
        setTimerRunning(false);
        setStopwatchSeconds(0);
        return 0;
      });
    }, 1000);
  };

  useEffect(() => {
  if (!onBreak) return;
  intervalRef.current = setInterval(() => {
    setBreakTimeLeft(prev => {
      if (prev > 1) return prev - 1;

      clearInterval(intervalRef.current!);
      setOnBreak(false);
      setTimerRunning(false);
      setStopwatchSeconds(0);
      return 0;
    });
  }, 1000);
}, [onBreak]);

  const handleStop = async () => {
  clearInterval(intervalRef.current!);
  setTimerRunning(false);

  const today = new Date().toISOString().split('T')[0];

  // Calculate how many seconds were actually studied
  const secondsStudied =
    mode === 'stopwatch' ? stopwatchSeconds :
    mode === 'custom' ? Math.max(0, (parseInt(customMinutes || '0') * 60) - timeLeft) :
    mode in presets ? Math.max(0, presets[mode as keyof typeof presets] - timeLeft) :
    0;

  const roundedHours = Math.round((secondsStudied / 3600) * 10) / 10;

  if (roundedHours <= 0 || !subject) return;

  try {
    await fetch('/api/user/study-hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        subject,
        duration: roundedHours,
      }),
    });
  } catch (err) {
    console.error('Error saving study hours:', err);
  }

  setTimeLeft(0);
  setStopwatchSeconds(0);
};

  const handleAddSubject = async () => {
    const name = newSubject.trim().toLowerCase();
    if (!name || subjects.includes(name)) return alert('Invalid or duplicate subject name');
    if (Object.values(subjectColors).includes(newColor)) return alert('Color already in use');

    const updatedSubjects = [...subjects, name];
    const updatedColors = { ...subjectColors, [name]: newColor };
    setSubjects(updatedSubjects);
    setSubjectColors(updatedColors);
    setNewSubject('');
    setNewColor('#f97316');

    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const total = onBreak ?
    Math.floor((mode === 'custom' ? parseInt(customMinutes) * 60 : mode === 'stopwatch' ? stopwatchSeconds : presets[mode === 'pomodoro' ? 'pomodoro' : 'reversePomodoro']) / 3) :
    (mode === 'custom' ? parseInt(customMinutes) * 60 : mode === 'stopwatch' ? stopwatchSeconds : presets[mode === 'pomodoro' ? 'pomodoro' : 'reversePomodoro']);

  const studyTotal =
  mode === 'custom' ? parseInt(customMinutes) * 60 :
  mode === 'stopwatch' ? stopwatchSeconds :
  presets[mode];

  const progress = onBreak
  ? 1 - breakTimeLeft / Math.max(1, Math.floor(studyTotal / 3))
  : mode === 'stopwatch' ? 1 : 1 - timeLeft / Math.max(1, studyTotal);

  return (
    <div className="min-h-screen bg-orange-50 text-white px-4 py-6 md:px-8 lg:px-16 flex flex-col gap-6">
      <div className="self-start">
        <Link href="/dashboard">
          <button className="text-base md:text-xl px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600 transition">
            Go To Dashboard
          </button>
        </Link>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-center">Study Timer</h1>

      {/* Mode Selection */}
      <div className="flex flex-wrap gap-3 justify-center">
        {['pomodoro', 'reversePomodoro', 'custom', 'stopwatch'].map(m => (
          <button
            key={m}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === m ? 'bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => {
              setMode(m as any);
              setOnBreak(false);
              setTimerRunning(false);
              setStopwatchSeconds(0);
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Subject Selector */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3">
        <label className="text-white">Subject:</label>
        <select
          className="text-black px-2 py-1 rounded w-full md:w-auto"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        >
          {subjects.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Custom Timer Input */}
      {mode === 'custom' && (
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-black">
          <label className="text-white">Minutes (1–180):</label>
          <input
            className="text-black px-2 py-1 rounded w-24"
            type="number"
            value={customMinutes}
            onChange={e => setCustomMinutes(e.target.value)}
          />
        </div>
      )}

      {/* Timer Progress Circle */}
      <div className="w-64 h-64 mx-auto">
        <CircularProgressbar
          value={progress * 100}
          text={onBreak ? `Break: ${formatTime(breakTimeLeft)}` : formatTime(timeLeft)}
          styles={buildStyles({
            pathColor: onBreak ? '#60a5fa' : subjectColors[subject] || '#f97316',
            textColor: onBreak ? '#60a5fa' : subjectColors[subject] || '#f97316',
            trailColor: '#374151',
          })}
        />
      </div>

      {/* Start / Stop Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {!timerRunning && (
          <button className="px-6 py-2 bg-green-600 rounded-xl hover:bg-green-700 transition" onClick={handleStart}>
            Start
          </button>
        )}
        {timerRunning && (
          <button className="px-6 py-2 bg-red-600 rounded-xl hover:bg-red-700 transition" onClick={handleStop}>
            Stop
          </button>
        )}
      </div>

      {/* Add Subject Form */}
      <div className="w-full max-w-lg bg-gray-800 p-4 rounded-xl mx-auto">
        <h2 className="text-lg font-semibold mb-2">Add New Subject</h2>
        <input
          type="text"
          placeholder="Subject name"
          value={newSubject}
          onChange={e => setNewSubject(e.target.value)}
          className="w-full mb-2 px-2 py-1 rounded text-white bg-gray-700"
        />
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="w-full mb-2 h-10"
        />
        <button onClick={handleAddSubject} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded">
          Add Subject
        </button>
      </div>

      {/* Delete Subject Section */}
      <div className="w-full max-w-lg bg-gray-800 p-4 rounded-xl mx-auto">
        <h2 className="text-lg font-semibold mb-2">Delete Subject</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="text-white bg-gray-800 px-2 py-1 rounded w-full md:w-auto"
          >
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              const updatedSubjects = subjects.filter(s => s !== subject);
              const updatedColors = { ...subjectColors };
              delete updatedColors[subject];

              setSubjects(updatedSubjects);
              setSubjectColors(updatedColors);

              await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
              });

              setSubject(updatedSubjects[0] || '');
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
}

export default TimerPage;
