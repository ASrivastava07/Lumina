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
  // This state will store the time studied *before* a pause (for custom/stopwatch)
  const [prePauseStudySeconds, setPrePauseStudySeconds] = useState(0);

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
  }, [subject]);

  const presets = {
    pomodoro: 25 * 60,
    reversePomodoro: 5 * 60,
  };

  // --- Timer Initialization/Reset Effect ---
  useEffect(() => {
    // Only reset if the timer is not running and not on a break.
    // This prevents resets while a timer is active or paused.
    if (!timerRunning && !onBreak) {
      if (mode === 'stopwatch') {
        setStopwatchSeconds(0);
        setCountdownTimeLeft(0);
        setInitialCountdownDuration(0);
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
        setStopwatchSeconds(0);
      }
      setPrePauseStudySeconds(0); // Reset pre-pause time on mode change/reset
    }
  }, [mode, customMinutes, timerRunning, onBreak]);

  // --- Handle Start Timer ---
  const handleStart = () => {
    if (!subject) return alert('Please select a subject');
    if (timerRunning) return; // Prevent starting if already running

    // Clear any existing interval to prevent multiple timers running simultaneously
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setTimerRunning(true);
    setOnBreak(false);

    // Set initial values only if starting fresh (not resuming from a pause)
    if (mode === 'pomodoro') {
      if (initialCountdownDuration === 0 || countdownTimeLeft === 0) {
        setInitialCountdownDuration(presets.pomodoro);
        setCountdownTimeLeft(presets.pomodoro);
      }
    } else if (mode === 'reversePomodoro') {
      if (initialCountdownDuration === 0 || countdownTimeLeft === 0) {
        setInitialCountdownDuration(presets.reversePomodoro);
        setCountdownTimeLeft(presets.reversePomodoro);
      }
    } else if (mode === 'custom') {
      const customDur = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);
      if (customDur <= 0) {
        setTimerRunning(false);
        return alert('Invalid custom time. Please enter 1-180 minutes.');
      }
      if (initialCountdownDuration === 0 || countdownTimeLeft === 0) {
        setInitialCountdownDuration(customDur);
        setCountdownTimeLeft(customDur);
      }
    } else if (mode === 'stopwatch') {
      setInitialCountdownDuration(0); // Stopwatch has no fixed initial duration
      // stopwatchSeconds should retain its value if starting after a pause,
      // but if starting fresh, it will be 0 due to the useEffect or manual reset.
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

          const breakDuration = (mode === 'pomodoro' || mode === 'reversePomodoro')
            ? 5 * 60 // Fixed 5 min break for Pomodoro/Reverse
            : Math.floor(actualStudyTimeForBreak / 3); // 1/3 of study time for custom

          if (breakDuration > 0) {
            setBreakTimeLeft(breakDuration);
            setOnBreak(true); // Initiate break
            setPrePauseStudySeconds(actualStudyTimeForBreak); // Store the completed study time for saving after break
          } else {
            // If no break (e.g., custom very short timer), just save and reset for next session
            handleSaveStudyTime(actualStudyTimeForBreak); // Save the study time
            setStopwatchSeconds(0);
            setCountdownTimeLeft(initialCountdownDuration); // Reset countdown to its initial value for next run
            setTimerRunning(false);
            setOnBreak(false);
            setPrePauseStudySeconds(0); // Reset pre-pause time
          }
          return 0; // Set countdown to 0 when finished
        });
      }
    }, 1000);
  };

  // --- Handle Pause Timer (for Custom and Stopwatch) ---
  const handlePause = async () => {
    if (!timerRunning || onBreak) return; // Only pause if timer is running and not already on break

    clearInterval(intervalRef.current!); // Stop the current interval
    setTimerRunning(false);

    let actualStudyTimeForBreak = 0;

    if (mode === 'stopwatch') {
      actualStudyTimeForBreak = stopwatchSeconds;
    } else if (mode === 'custom') {
      // For custom, it's the time studied so far in the current segment
      actualStudyTimeForBreak = initialCountdownDuration - countdownTimeLeft;
    } else {
      // Pomodoro and Reverse Pomodoro don't have a 'pause for break' in the same way.
      // They only trigger a break *after* completing the full study time.
      // If a pause is clicked for these modes, we can simply stop and save.
      await handleStop();
      return;
    }

    const breakDuration = Math.floor(actualStudyTimeForBreak / 3);

    if (breakDuration > 0) {
      setBreakTimeLeft(breakDuration);
      setOnBreak(true); // Initiate break
      setPrePauseStudySeconds(actualStudyTimeForBreak); // Store the time studied for saving after break
    } else {
      // If no significant study time for a break, just stop the timer and save any minimal time.
      await handleSaveStudyTime(actualStudyTimeForBreak); // Save the study time
      setCountdownTimeLeft(0);
      setStopwatchSeconds(0);
      setPrePauseStudySeconds(0);
      setTimerRunning(false);
      setOnBreak(false);
    }
  };

  // --- Handle Break Timer ---
  // This useEffect ensures the break timer runs automatically when `onBreak` state is true
  useEffect(() => {
    if (!onBreak) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

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

        // Save the study time that led to this break
        handleSaveStudyTime(prePauseStudySeconds); // Use the stored pre-pause study time
        setPrePauseStudySeconds(0); // Reset after saving

        // Reset for next study session
        if (mode === 'stopwatch') {
          setStopwatchSeconds(0);
        } else {
          setCountdownTimeLeft(initialCountdownDuration); // Reset countdown to its initial value for next run
        }
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
  }, [onBreak, initialCountdownDuration, mode, prePauseStudySeconds]); // Depend on onBreak, initialCountdownDuration, mode, and prePauseStudySeconds

  // --- Unified function to save study time ---
  const handleSaveStudyTime = async (seconds: number) => {
    const today = new Date().toISOString().split('T')[0];
    const roundedHours = Math.round((seconds / 3600) * 10) / 10;

    // Only save study hours if a valid subject is selected and time was actually studied
    if (roundedHours <= 0 || !subject) {
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
  };

  // --- Handle Stop Timer ---
  const handleStop = async () => {
    clearInterval(intervalRef.current!); // Stop any active interval
    setTimerRunning(false);
    setOnBreak(false); // Ensure break state is off

    let secondsStudied = 0;
    if (mode === 'stopwatch') {
      secondsStudied = stopwatchSeconds;
    } else { // 'pomodoro', 'reversePomodoro', 'custom'
      // For countdown timers, it's the initial duration minus what's left
      secondsStudied = Math.max(0, initialCountdownDuration - countdownTimeLeft);
    }

    await handleSaveStudyTime(secondsStudied);

    // Reset timer visuals after stopping and saving
    setCountdownTimeLeft(0);
    setStopwatchSeconds(0);
    setPrePauseStudySeconds(0); // Ensure this is also reset
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
    ? `Break: ${formatTime(breakTimeLeft)}` // Show "Break: MM:SS"
    : mode === 'stopwatch'
      ? formatTime(stopwatchSeconds)
      : formatTime(countdownTimeLeft);

  // Determines the total duration for progress calculation (denominator for the fraction)
  let totalForProgressBar = 0;
  if (onBreak) {
    // When on break, the progress bar should show the break duration
    // For pomodoro/reverse, the break is fixed, so use 5 minutes for progress bar total
    if (mode === 'pomodoro' || mode === 'reversePomodoro') {
      totalForProgressBar = 5 * 60;
    } else { // For custom/stopwatch breaks
      totalForProgressBar = Math.floor(prePauseStudySeconds / 3);
    }
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
      ? (stopwatchSeconds / (180 * 60)) > 1 ? 1 : (stopwatchSeconds / (180 * 60)) // show progress based on a max of 3 hours, or cap at 1
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
              setCountdownTimeLeft(0); // Explicitly reset countdown
              setInitialCountdownDuration(0); // Explicitly reset initial duration
              setPrePauseStudySeconds(0); // Reset pre-pause time
              if (intervalRef.current) { // Clear any running interval when changing modes
                clearInterval(intervalRef.current);
              }
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
          className="text-black border border-black px-2 py-1 rounded w-full md:w-auto"
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
          <label className="text-black">Minutes (1–180):</label>
          <input
            className="text-black border border-black px-2 py-1 rounded w-24"
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
          text={displayTime as string | undefined} // Explicitly cast to string | undefined
          styles={buildStyles({
            pathColor: onBreak ? '#60a5fa' : subjectColors[subject] || '#f97316',
            textColor: onBreak ? '#60a5fa' : subjectColors[subject] || '#f97316',
            trailColor: '#374151',
          })}
        />
      </div>

      {/* Start / Stop / Pause Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {!timerRunning && !onBreak && (
          <button className="px-6 py-2 bg-green-600 rounded-xl hover:bg-green-700 transition" onClick={handleStart}>
            Start
          </button>
        )}
        {timerRunning && (
          <>
            {(mode === 'custom' || mode === 'stopwatch') && ( // Only show Pause for custom/stopwatch
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