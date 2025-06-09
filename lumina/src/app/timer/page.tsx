'use client';

import Link from 'next/link';
import React, { useEffect, useState, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const TimerPage = () => {
  const [mode, setMode] = useState<'pomodoro' | 'reversePomodoro' | 'stopwatch' | 'custom'>('pomodoro');
  const [countdownTimeLeft, setCountdownTimeLeft] = useState(1500); // Remaining time for countdowns
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0); // Elapsed time for stopwatch
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectColors, setSubjectColors] = useState<{ [key: string]: string }>({});
  const [newSubject, setNewSubject] = useState('');
  const [newColor, setNewColor] = useState('#f97316');

  // Stores the initial duration of the main study timer when it starts (only for countdown modes)
  const [initialCountdownDuration, setInitialCountdownDuration] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    fetch('/api/user/preferences')
      .then(res => res.json())
      .then(data => {
        setSubjects(data.subjects || []);
        setSubjectColors(data.subjectcolors || {});
        // Set default subject if none is selected and subjects exist
        if (!subject && data.subjects.length > 0) {
          setSubject(data.subjects[0]);
        }
      });
  }, [subject]); // Added subject to dependency array to re-fetch if subject changes (though typically not needed)

  const presets = {
    pomodoro: 25 * 60,
    reversePomodoro: 5 * 60,
  };

  // --- Timer Initialization/Reset Effect ---
  // This effect handles setting initial timer values when the mode or custom time changes,
  // but only when the timer is NOT running or on break.
  useEffect(() => {
    if (!timerRunning && !onBreak) {
      if (mode === 'stopwatch') {
        setStopwatchSeconds(0);
        setCountdownTimeLeft(0); // Ensure countdown is cleared for stopwatch mode
        setInitialCountdownDuration(0); // Stopwatch has no fixed initial duration
      } else { // This block handles 'pomodoro', 'reversePomodoro', 'custom'
        let durationToSet = 0;
        if (mode === 'pomodoro') {
          durationToSet = presets.pomodoro;
        } else if (mode === 'reversePomodoro') {
          durationToSet = presets.reversePomodoro;
        } else if (mode === 'custom') {
          durationToSet = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);
        }
        setCountdownTimeLeft(durationToSet);
        setInitialCountdownDuration(durationToSet);
        setStopwatchSeconds(0); // Reset stopwatch if switching from it
      }
    }
  }, [mode, customMinutes, timerRunning, onBreak]);

  // --- Handle Start Timer ---
  const handleStart = () => {
    if (!subject) return alert('Please select a subject');

    // Clear any existing interval to prevent multiple timers running simultaneously
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setTimerRunning(true);
    setOnBreak(false);
    setStopwatchSeconds(0); // Always reset stopwatch on new start

    if (mode === 'pomodoro') {
      setInitialCountdownDuration(presets.pomodoro);
      setCountdownTimeLeft(presets.pomodoro);
    } else if (mode === 'reversePomodoro') {
      setInitialCountdownDuration(presets.reversePomodoro);
      setCountdownTimeLeft(presets.reversePomodoro);
    } else if (mode === 'custom') {
      const customDur = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);
      if (customDur <= 0) {
        setTimerRunning(false); // Do not start if custom time is invalid
        return alert('Invalid custom time. Please enter 1-180 minutes.');
      }
      setInitialCountdownDuration(customDur);
      setCountdownTimeLeft(customDur);
    } else if (mode === 'stopwatch') {
      // For stopwatch, initialCountdownDuration is irrelevant for start
      setInitialCountdownDuration(0);
      setStopwatchSeconds(0); // Redundant due to above, but explicit
    }

    // Start the main timer interval
    intervalRef.current = setInterval(() => {
      if (mode === 'stopwatch') {
        setStopwatchSeconds(s => s + 1); // Stopwatch counts up
      } else { // This block handles 'pomodoro', 'reversePomodoro', 'custom' countdowns
        setCountdownTimeLeft(prev => {
          if (prev > 1) {
            return prev - 1; // Decrement countdown
          }

          // Countdown timer has finished
          clearInterval(intervalRef.current!);
          setTimerRunning(false); // Stop the main timer

          // Calculate study time for break (if applicable)
          let actualStudyTimeForBreak = 0;
          if (mode === 'pomodoro') {
            actualStudyTimeForBreak = presets.pomodoro;
          } else if (mode === 'reversePomodoro') {
            actualStudyTimeForBreak = presets.reversePomodoro;
          } else if (mode === 'custom') {
            actualStudyTimeForBreak = initialCountdownDuration; // Use the stored initial duration
          }

          const breakDuration = Math.floor(
            (mode === 'pomodoro' || mode === 'reversePomodoro') ? 5 * 60 : actualStudyTimeForBreak / 3
          );

          if (breakDuration > 0) {
            setBreakTimeLeft(breakDuration);
            setOnBreak(true); // Initiate break
          } else {
            // If no break (e.g., custom very short timer), just reset for next session
            setStopwatchSeconds(0);
            setCountdownTimeLeft(0);
            setTimerRunning(false);
            setOnBreak(false);
          }
          return 0; // Set countdown to 0 when finished
        });
      }
    }, 1000);
  };

  // --- Handle Break Timer ---
  // This useEffect ensures the break timer runs automatically when `onBreak` state is true
  useEffect(() => {
    if (!onBreak) return;

    // Clear any existing interval to prevent multiple break intervals running
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setBreakTimeLeft(prev => {
        if (prev > 1) return prev - 1;

        // Break timer finished
        clearInterval(intervalRef.current!);
        setOnBreak(false);
        setTimerRunning(false); // Timer stops after break

        // Reset for next study session
        setStopwatchSeconds(0);
        setCountdownTimeLeft(initialCountdownDuration); // Reset countdown to its initial value for next run
        return 0;
      });
    }, 1000);

    // Cleanup function: important to clear the interval when the component unmounts
    // or when dependencies change (like `onBreak` becoming false)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [onBreak, initialCountdownDuration]); // Depend on onBreak and initialCountdownDuration

  // --- Handle Stop Timer ---
  const handleStop = async () => {
    clearInterval(intervalRef.current!); // Stop any active interval
    setTimerRunning(false);
    setOnBreak(false); // Ensure break state is off

    const today = new Date().toISOString().split('T')[0];

    // Calculate how many seconds were actually studied based on the current mode
    let secondsStudied = 0;
    if (mode === 'stopwatch') {
      secondsStudied = stopwatchSeconds;
    } else { // 'pomodoro', 'reversePomodoro', 'custom'
      // For countdown timers, it's the initial duration minus what's left
      secondsStudied = Math.max(0, initialCountdownDuration - countdownTimeLeft);
    }

    const roundedHours = Math.round((secondsStudied / 3600) * 10) / 10;

    // Only save study hours if a valid subject is selected and time was actually studied
    if (roundedHours <= 0 || !subject) {
      // Still reset visuals even if not saving data
      setCountdownTimeLeft(0);
      setStopwatchSeconds(0);
      return;
    }

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

    // Reset timer visuals after stopping and saving
    setCountdownTimeLeft(0);
    setStopwatchSeconds(0);
  };

  // --- Subject Management ---
  const handleAddSubject = async () => {
    const name = newSubject.trim().toLowerCase();
    if (!name) return alert('Subject name cannot be empty.');
    if (subjects.includes(name)) return alert('Subject already exists.');
    if (Object.values(subjectColors).includes(newColor)) return alert('Color already in use. Please choose a different one.');

    const updatedSubjects = [...subjects, name];
    const updatedColors = { ...subjectColors, [name]: newColor };
    setSubjects(updatedSubjects);
    setSubjectColors(updatedColors);
    setNewSubject('');
    setNewColor('#f97316'); // Reset to a default color

    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
      alert('Failed to add subject. Please try again.');
    }
  };

  // --- Helper for Time Formatting ---
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- Dynamic Display Values ---
  // Determines what time string to show in the CircularProgressbar
  const displayTime = onBreak
    ? formatTime(breakTimeLeft)
    : mode === 'stopwatch'
      ? formatTime(stopwatchSeconds)
      : formatTime(countdownTimeLeft);

  // Determines the total duration for progress calculation (denominator for the fraction)
  let totalForProgressBar = 0;
  if (onBreak) {
    totalForProgressBar = Math.floor(initialCountdownDuration / 3);
  } else if (mode === 'pomodoro') {
    totalForProgressBar = presets.pomodoro;
  } else if (mode === 'reversePomodoro') {
    totalForProgressBar = presets.reversePomodoro;
  } else if (mode === 'custom') {
    totalForProgressBar = initialCountdownDuration;
  }
  // For 'stopwatch' mode, `progress` is typically 1 (or based on some arbitrary max if you had one)

  // Calculate the progress percentage for the CircularProgressbar
  const progress = onBreak
    ? (totalForProgressBar > 0 ? 1 - breakTimeLeft / totalForProgressBar : 0) // Progress of the break
    : mode === 'stopwatch'
      ? 1 // Stopwatch is "always progressing" or just shows elapsed time
      : (totalForProgressBar > 0 ? 1 - countdownTimeLeft / totalForProgressBar : 0); // Progress of countdown

  return (
    <div className="min-h-screen bg-orange-50 text-white px-4 py-6 md:px-8 lg:px-16 flex flex-col gap-6">
      <div className="self-start">
        <Link href="/dashboard">
          <button className="text-base md:text-xl px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600 transition">
            Go To Dashboard
          </button>
        </Link>
      </div>

      <h1 className="text-2xl md:text-3xl text-black font-bold text-center">Study Timer</h1>

      {/* Mode Selection Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        {['pomodoro', 'reversePomodoro', 'custom', 'stopwatch'].map(m => (
          <button
            key={m}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === m ? 'bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => {
              setMode(m as any); // Casting 'm' to `any` here is usually fine as `m` is one of the defined modes
              setOnBreak(false);
              setTimerRunning(false);
              setStopwatchSeconds(0);
              // The useEffect above will handle resetting countdownTimeLeft based on the new mode
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Subject Selector */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3">
        <label className="text-black">Subject:</label>
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
            min="1" // Ensure minimum is 1
            max="180" // Ensure maximum is 180
          />
        </div>
      )}

      {/* Timer Progress Circle Display */}
      <div className="w-64 h-64 mx-auto">
        <CircularProgressbar
          value={progress * 100}
          text={displayTime} // Use the combined displayTime variable
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

      {/* Add New Subject Form */}
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

              // Update preferences in the backend
              await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
              });

              setSubject(updatedSubjects[0] || ''); // Select first subject or none if empty
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