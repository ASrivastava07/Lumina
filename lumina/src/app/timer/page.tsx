'use client';

import Link from 'next/link';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

// Define types for better type safety
interface SubjectColorsMap {
  [key: string]: string;
}

export default function TimerPage() {
  const [mode, setMode] = useState<'pomodoro' | 'reversePomodoro' | 'stopwatch' | 'custom'>('pomodoro');
  const [countdownTimeLeft, setCountdownTimeLeft] = useState<number>(1500); // Remaining time for countdowns
  const [breakTimeLeft, setBreakTimeLeft] = useState<number>(0);
  const [onBreak, setOnBreak] = useState<boolean>(false);
  const [timerRunning, setTimerRunning] = useState<boolean>(false); // Indicates if the study timer is active
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0); // Elapsed time for stopwatch
  const [subject, setSubject] = useState<string>('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectColorsMap, setSubjectColorsMap] = useState<SubjectColorsMap>({});
  const [newSubject, setNewSubject] = useState<string>('');
  const [newColor, setNewColor] = useState<string>('#f97316');
  const [loading, setLoading] = useState<boolean>(true); // New loading state for initial fetch

  const [initialCountdownDuration, setInitialCountdownDuration] = useState<number>(0);
  const [prePauseStudySeconds, setPrePauseStudySeconds] = useState<number>(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const presets = {
    pomodoro: 25 * 60, // 25 minutes study
    reversePomodoro: 5 * 60, // 5 minutes study
    pomodoroBreak: 5 * 60, // 5 minutes break
    reversePomodoroBreak: 25 * 60, // 25 minutes break
  };

  // --- Initial Data Fetching ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Fetch user preferences (subjects + colors) in parallel
        const prefRes = await fetch('/api/user/preferences');
        const prefData = await prefRes.json();

        if (!prefRes.ok || !Array.isArray(prefData.subjects) || typeof prefData.subjectcolors !== 'object') {
          throw new Error(prefData.message || 'Failed to load user preferences.');
        }

        setSubjects(prefData.subjects);
        setSubjectColorsMap(prefData.subjectcolors);

        // Set default subject if available
        if (prefData.subjects.length > 0) {
          setSubject(prefData.subjects[0]);
        }
      } catch (err: any) {
        console.error('Error fetching initial timer data:', err);
        alert(`Failed to load necessary data: ${err.message}. Please try again.`);
        // Consider redirecting or showing a robust error page if critical data fails to load
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []); // Run only once on component mount

  // --- Timer Initialization/Reset Effect (only on mode/customMinutes change, if not running) ---
  useEffect(() => {
    if (!timerRunning && !onBreak) {
      if (mode === 'stopwatch') {
        setStopwatchSeconds(0);
        setCountdownTimeLeft(0);
        setInitialCountdownDuration(0);
      } else {
        let durationToSet = 0;
        if (mode === 'pomodoro') {
          durationToSet = presets.pomodoro;
        } else if (mode === 'reversePomodoro') {
          durationToSet = presets.reversePomodoro;
        } else if (mode === 'custom') {
          durationToSet = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);
          if (durationToSet <= 0 && customMinutes !== '') { // Prevent alert on initial render if customMinutes is empty
              alert('Invalid custom time. Please enter 1-180 minutes.');
              setCustomMinutes(''); // Reset custom minutes if invalid
          }
        }
        setCountdownTimeLeft(durationToSet);
        setInitialCountdownDuration(durationToSet);
        setStopwatchSeconds(0);
      }
      setPrePauseStudySeconds(0);
    }
  }, [mode, customMinutes, timerRunning, onBreak, presets.pomodoro, presets.reversePomodoro]);


  // --- Unified function to save study time (Memoized) ---
  const handleSaveStudyTime = useCallback(async (seconds: number) => {
    const today = new Date().toISOString().split('T')[0];
    const roundedHours = Math.round((seconds / 3600) * 10) / 10;

    if (roundedHours <= 0 || !subject) {
      console.warn('Skipping save: No valid study time or subject selected.');
      return;
    }

    try {
      const res = await fetch('/api/user/study-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          subject,
          duration: roundedHours,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save study hours.');
      }
      console.log(`Saved ${roundedHours} hours for ${subject} on ${today}`);
    } catch (err: any) {
      console.error('Error saving study hours:', err);
      alert(`Error saving study time: ${err.message}`);
    }
  }, [subject]); // Depends on `subject`

  // --- Handle Stop Timer (Memoized) ---
  const handleStop = useCallback(async () => {
    // Clear any active interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerRunning(false);
    setOnBreak(false);

    let secondsStudied = 0;
    if (mode === 'stopwatch') {
      secondsStudied = stopwatchSeconds;
    } else if (initialCountdownDuration > 0) { // For countdowns, calculate based on initial duration
      secondsStudied = Math.max(0, initialCountdownDuration - countdownTimeLeft);
    }

    await handleSaveStudyTime(secondsStudied);

    // Reset timer visuals after stopping and saving
    setCountdownTimeLeft(0); // This will trigger the useEffect to re-initialize based on mode
    setStopwatchSeconds(0);
    setPrePauseStudySeconds(0);

  }, [mode, stopwatchSeconds, initialCountdownDuration, countdownTimeLeft, handleSaveStudyTime]); // Dependencies

  // --- Handle Start Timer (Memoized) ---
  const handleStart = useCallback(() => {
    if (!subject) {
      alert('Please select a subject before starting the timer.');
      return;
    }
    if (mode === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0)) {
        alert('Please enter a valid custom time (1-180 minutes).');
        return;
    }
    if (timerRunning) return; // Prevent starting if already running or on break

    // Initialize/re-initialize timer states before starting the interval
    let currentInitialDuration = initialCountdownDuration; // Use current initial duration if resuming

    if (mode === 'pomodoro') {
        if (countdownTimeLeft === 0 || initialCountdownDuration === 0) {
            currentInitialDuration = presets.pomodoro;
            setInitialCountdownDuration(presets.pomodoro);
            setCountdownTimeLeft(presets.pomodoro);
        }
    } else if (mode === 'reversePomodoro') {
        if (countdownTimeLeft === 0 || initialCountdownDuration === 0) {
            currentInitialDuration = presets.reversePomodoro;
            setInitialCountdownDuration(presets.reversePomodoro);
            setCountdownTimeLeft(presets.reversePomodoro);
        }
    } else if (mode === 'custom') {
        const customDur = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);
        if (customDur <= 0) {
            alert('Invalid custom time. Please enter 1-180 minutes.');
            return;
        }
        if (countdownTimeLeft === 0 || initialCountdownDuration === 0) {
            currentInitialDuration = customDur;
            setInitialCountdownDuration(customDur);
            setCountdownTimeLeft(customDur);
        }
    } else if (mode === 'stopwatch') {
        setInitialCountdownDuration(0); // Stopwatch has no fixed initial duration
        if (stopwatchSeconds === 0) { // Reset if starting fresh
            setStopwatchSeconds(0);
        }
    }
    
    setOnBreak(false); // Ensure not on break
    setTimerRunning(true); // This will trigger the main useEffect to start the interval

  }, [subject, timerRunning, mode, customMinutes, countdownTimeLeft, initialCountdownDuration, presets.pomodoro, presets.reversePomodoro]); // Dependencies

  // --- Handle Pause Timer (Memoized for Custom and Stopwatch) ---
  const handlePause = useCallback(async () => {
    if (!timerRunning || onBreak) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerRunning(false);

    let currentSessionStudyTime = 0;
    if (mode === 'stopwatch') {
      currentSessionStudyTime = stopwatchSeconds;
    } else { // custom, pomodoro, reverse pomodoro
      currentSessionStudyTime = initialCountdownDuration - countdownTimeLeft;
    }

    const breakDuration = Math.floor(currentSessionStudyTime / 3);

    if (breakDuration > 0) {
      setBreakTimeLeft(breakDuration);
      setOnBreak(true); // This will trigger the main useEffect for break timer
      setPrePauseStudySeconds(currentSessionStudyTime);
    } else {
      await handleSaveStudyTime(currentSessionStudyTime);
      setCountdownTimeLeft(0);
      setStopwatchSeconds(0);
      setPrePauseStudySeconds(0);
      setOnBreak(false);
    }
  }, [timerRunning, onBreak, mode, stopwatchSeconds, initialCountdownDuration, countdownTimeLeft, handleSaveStudyTime]); // Dependencies

  // --- NEW: Unified Timer & Break Interval Management Effect ---
  useEffect(() => {
    // Clear any existing interval when dependencies change or component unmounts
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up interval if timer is running OR on break
    if (timerRunning || onBreak) {
      intervalRef.current = setInterval(() => {
        if (onBreak) {
          setBreakTimeLeft(prev => {
            if (prev <= 1) {
              // Break ends
              clearInterval(intervalRef.current!);
              intervalRef.current = null;
              setOnBreak(false); // Transition out of break
              handleSaveStudyTime(prePauseStudySeconds); // Save study time after break
              setPrePauseStudySeconds(0);

              // Prepare for the next study session automatically if not stopwatch
              let nextStudyDuration = 0;
              if (mode === 'pomodoro') nextStudyDuration = presets.pomodoro;
              else if (mode === 'reversePomodoro') nextStudyDuration = presets.reversePomodoro;
              else if (mode === 'custom') nextStudyDuration = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);

              // Only reset countdown if not stopwatch and duration is valid
              if (mode !== 'stopwatch' && nextStudyDuration > 0) {
                setCountdownTimeLeft(nextStudyDuration);
                setInitialCountdownDuration(nextStudyDuration);
              }
              setStopwatchSeconds(0); // Always reset stopwatch seconds

              // Automatically start next study session
              // Small delay to allow state updates to propagate and for the UI to reflect changes
              setTimeout(() => {
                setTimerRunning(true); // This will re-trigger this useEffect to start the next study interval
              }, 50); // A very small delay, can be 0 or slightly more to ensure state updates

              return 0; // Return 0 to set breakTimeLeft to 0
            }
            return prev - 1;
          });
        } else if (timerRunning) { // If not on break, and study timer is running
          if (mode === 'stopwatch') {
            setStopwatchSeconds(s => s + 1);
          } else { // Countdown modes (pomodoro, reversePomodoro, custom)
            setCountdownTimeLeft(prev => {
              if (prev <= 1) {
                // Study session ends
                clearInterval(intervalRef.current!);
                intervalRef.current = null;
                setTimerRunning(false);

                const actualStudyTimeCompleted = initialCountdownDuration;

                let breakDuration = 0;
                if (mode === 'pomodoro') breakDuration = presets.pomodoroBreak;
                else if (mode === 'reversePomodoro') breakDuration = presets.reversePomodoroBreak;
                else if (mode === 'custom') breakDuration = Math.floor(actualStudyTimeCompleted / 3);

                if (breakDuration > 0) {
                  setBreakTimeLeft(breakDuration);
                  setOnBreak(true); // Transition to break, triggering this useEffect for break timer
                  setPrePauseStudySeconds(actualStudyTimeCompleted);
                } else {
                  handleSaveStudyTime(actualStudyTimeCompleted); // Save time if no break
                  setStopwatchSeconds(0); // Reset stopwatch if applicable
                  // Reset countdown and initial duration for next session if study mode
                  let nextStudyDuration = 0;
                  if (mode === 'pomodoro') nextStudyDuration = presets.pomodoro;
                  else if (mode === 'reversePomodoro') nextStudyDuration = presets.reversePomodoro;
                  else if (mode === 'custom') nextStudyDuration = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);

                  setCountdownTimeLeft(nextStudyDuration);
                  setInitialCountdownDuration(nextStudyDuration);
                  setPrePauseStudySeconds(0);
                  setOnBreak(false); // Ensure not on break
                }
                return 0; // Return 0 to set countdownTimeLeft to 0
              }
              return prev - 1;
            });
          }
        }
      }, 1000);
    }

    // Cleanup function: Clear interval when timer stops, break ends, or component unmounts
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    timerRunning, // Trigger effect when study timer starts/stops
    onBreak,      // Trigger effect when break starts/ends
    mode,
    customMinutes,
    initialCountdownDuration, // To capture the correct duration at the start of a session
    prePauseStudySeconds,
    handleSaveStudyTime,
    presets.pomodoro,
    presets.reversePomodoro,
    presets.pomodoroBreak,
    presets.reversePomodoroBreak,
  ]);


  // --- Subject Management (Memoized) ---
  const handleAddSubject = useCallback(async () => {
    const name = newSubject.trim().toLowerCase();
    if (!name) {
      alert('Subject name cannot be empty.');
      return;
    }
    if (subjects.includes(name)) {
      alert('Subject already exists.');
      return;
    }
    if (Object.values(subjectColorsMap).some(color => color.toLowerCase() === newColor.toLowerCase())) {
        alert('Color already in use. Please choose a different one.');
        return;
    }

    const updatedSubjects = [...subjects, name];
    const updatedColors = { ...subjectColorsMap, [name]: newColor };

    // Optimistic UI update
    setSubjects(updatedSubjects);
    setSubjectColorsMap(updatedColors);

    // ⭐ FIX FOR ISSUE 1: Automatically select the newly added subject if none was selected
    if (!subject || subjects.length === 0) { // If 'subject' was empty or no subjects existed before
      setSubject(name);
    }

    setNewSubject('');
    setNewColor('#f97316'); // Reset to a default color

    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
      });
      if (!res.ok) {
        // Revert UI on error
        setSubjects(subjects);
        setSubjectColorsMap(subjectColorsMap);
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save preferences.');
      }
      console.log('Subject added:', name);
    } catch (err: any) {
      console.error('Failed to add subject:', err);
      alert(`Failed to add subject: ${err.message}. Please try again.`);
    }
  }, [newSubject, subjects, newColor, subjectColorsMap, subject]); // Added `subject` to dependencies

  // --- Helper for Time Formatting ---
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- Dynamic Display Values ---
  const displayTime = mode === 'stopwatch'
    ? formatTime(stopwatchSeconds)
    : formatTime(countdownTimeLeft);

  let totalForProgressBar = 0;
  if (onBreak) {
    if (mode === 'pomodoro') {
      totalForProgressBar = presets.pomodoroBreak;
    } else if (mode === 'reversePomodoro') {
      totalForProgressBar = presets.reversePomodoroBreak;
    } else { // Custom or Stopwatch break
      totalForProgressBar = Math.floor(prePauseStudySeconds / 3);
    }
  } else if (mode === 'pomodoro') {
    totalForProgressBar = presets.pomodoro;
  } else if (mode === 'reversePomodoro') {
    totalForProgressBar = presets.reversePomodoro;
  } else if (mode === 'custom') {
    totalForProgressBar = initialCountdownDuration; // Use the initial duration set for the custom session
  }

  const progress = onBreak
    ? (totalForProgressBar > 0 ? (totalForProgressBar - breakTimeLeft) / totalForProgressBar : 0) // Progress from 0 to 1
    : mode === 'stopwatch'
      ? (stopwatchSeconds / (180 * 60)) > 1 ? 1 : (stopwatchSeconds / (180 * 60)) // Cap progress at max 180 min
      : (totalForProgressBar > 0 ? (totalForProgressBar - countdownTimeLeft) / totalForProgressBar : 0); // Progress from 0 to 1


  // --- Loading UI ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 text-orange-600">
        <p className="text-xl">Loading timer settings...</p>
      </div>
    );
  }

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
              // Reset all relevant states when mode changes
              setMode(m as any);
              setOnBreak(false);
              setTimerRunning(false);
              setStopwatchSeconds(0);
              setCountdownTimeLeft(0); // This will trigger useEffect to set correct initial value
              setInitialCountdownDuration(0);
              setPrePauseStudySeconds(0);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1).replace('pomodoro', ' Pomodoro')}
          </button>
        ))}
      </div>

      {/* Subject Selector */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3">
        <label className="text-black">Subject:</label>
        <select
          className="text-black px-2 py-1 rounded w-full md:w-auto border border-black"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          disabled={subjects.length === 0} // Disable if no subjects are loaded
        >
          {subjects.length > 0 ? (
            subjects.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))
          ) : (
            <option value="" disabled>No subjects added</option>
          )}
        </select>
      </div>

      {/* Custom Timer Input */}
      {mode === 'custom' && (
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-black">
          <label className="text-black">Minutes (1–180)</label>
          <input
            className="text-black px-2 py-1 border border-black rounded w-24"
            type="number"
            value={customMinutes}
            onChange={e => setCustomMinutes(e.target.value)}
            min="1"
            max="180"
          />
        </div>
      )}

      {/* Timer Progress Circle Display and "On Break" text */}
      <div className="flex items-center justify-center gap-4">
        <div className="w-64 h-64">
          <CircularProgressbar
            value={progress * 100}
            text={onBreak ? `Break: ${formatTime(breakTimeLeft)}` : displayTime}
            styles={{
              text: {
                dominantBaseline: 'middle',
                textAnchor: 'middle',
              },
              ...buildStyles({
                pathColor: onBreak ? '#60a5fa' : subjectColorsMap[subject] || '#f97316',
                textColor: onBreak ? '#60a5fa' : subjectColorsMap[subject] || '#f97316',
                trailColor: '#374151',
                textSize: '18px',
              }),
            }}
          />
        </div>
      </div>

      {/* Start / Stop / Pause Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {!timerRunning && !onBreak && (
          <button
            className="px-6 py-2 bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            onClick={handleStart}
            // Button is disabled if: loading, no subject, or custom mode with invalid time
            disabled={
                loading ||
                !subject ||
                (mode === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0))
            }
          >
            Start
          </button>
        )}
        {timerRunning && (
          <>
            {(mode === 'custom' || mode === 'stopwatch') && (
              <button className="px-6 py-2 bg-yellow-500 rounded-xl hover:bg-yellow-600 transition" onClick={handlePause}>
                Pause
              </button>
            )}
            <button className="px-6 py-2 bg-red-600 rounded-xl hover:bg-red-700 transition" onClick={handleStop}>
              Stop
            </button>
          </>
        )}
        {onBreak && (
          <button className="px-6 py-2 bg-red-600 rounded-xl hover:bg-red-700 transition" onClick={handleStop}>
            Stop Break & Save
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
          className="w-full mb-2 px-2 py-1 rounded text-white bg-gray-700 border border-gray-600"
        />
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="w-full mb-2 h-10 border border-gray-600"
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
            value={subject} // Using the currently selected subject for deletion
            onChange={e => setSubject(e.target.value)}
            className="text-white bg-gray-800 px-2 py-1 rounded w-full md:w-auto border border-gray-600"
            disabled={subjects.length === 0}
          >
            {subjects.length > 0 ? (
              subjects.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))
            ) : (
              <option value="" disabled>No subjects to delete</option>
            )}
          </select>
          <button
            onClick={async () => {
              if (!subject) {
                alert('Please select a subject to delete.');
                return;
              }
              if (!confirm(`Are you sure you want to delete the subject "${subject}"? This cannot be undone and will affect associated graphs.`)) {
                return;
              }

              const updatedSubjects = subjects.filter(s => s !== subject);
              const updatedColors = { ...subjectColorsMap };
              delete updatedColors[subject];

              // Optimistic UI update
              setSubjects(updatedSubjects);
              setSubjectColorsMap(updatedColors);
              setSubject(updatedSubjects[0] || ''); // Set new default or empty

              try {
                const res = await fetch('/api/user/preferences', {
                  method: 'POST', // Assuming POST handles updates for all preferences
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
                });
                if (!res.ok) {
                  // Revert on error
                  setSubjects(subjects);
                  setSubjectColorsMap(subjectColorsMap);
                  setSubject(subject);
                  const errorData = await res.json();
                  throw new Error(errorData.error || 'Failed to delete subject.');
                }
                console.log('Subject deleted:', subject);
              } catch (err: any) {
                console.error('Failed to delete subject:', err);
                alert(`Failed to delete subject: ${err.message}.`);
              }
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!subject || subjects.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
}