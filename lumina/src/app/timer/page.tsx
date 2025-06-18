'use client'; // This directive indicates that this is a Client Component, meaning it runs in the browser.

import Link from 'next/link'; // For navigating back to the dashboard.
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'; // Core React hooks for component logic and state management.
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'; // For displaying the timer visually.
import 'react-circular-progressbar/dist/styles.css'; // Stylesheet for the circular progress bar.

// Defining a type for a map that stores subject names and their associated colors.
interface SubjectColorsMap {
  [key: string]: string;
}

// The main component for the Study Timer page.
export default function TimerPage() {
  // State to manage the current mode of the timer: Pomodoro, Reverse Pomodoro, Stopwatch, or Custom.
  const [mode, setMode] = useState<'pomodoro' | 'reversePomodoro' | 'stopwatch' | 'custom'>('pomodoro');
  // State to hold the remaining time in seconds for countdown timers (Pomodoro, Custom).
  const [countdownTimeLeft, setCountdownTimeLeft] = useState<number>(1500); // Default to 25 minutes (1500 seconds).
  // State for the remaining time in seconds during a break session.
  const [breakTimeLeft, setBreakTimeLeft] = useState<number>(0);
  // State to indicate if the timer is currently in a break session.
  const [onBreak, setOnBreak] = useState<boolean>(false);
  // State to indicate if the main study timer is actively running.
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  // State for the user's input when setting a custom timer duration in minutes.
  const [customMinutes, setCustomMinutes] = useState<string>('');
  // State for the elapsed time in seconds for the stopwatch mode.
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  // State to store the currently selected subject for the study session.
  const [subject, setSubject] = useState<string>('');
  // State to store the list of subjects fetched from the user's preferences.
  const [subjects, setSubjects] = useState<string[]>([]);
  // State to store the mapping of subjects to their display colors.
  const [subjectColorsMap, setSubjectColorsMap] = useState<SubjectColorsMap>({});
  // State for the name of a new subject being added by the user.
  const [newSubject, setNewSubject] = useState<string>('');
  // State for the color of a new subject being added by the user (default orange).
  const [newColor, setNewColor] = useState<string>('#f97316');
  // State to indicate if initial data (subjects, colors) is being fetched from the server.
  const [loading, setLoading] = useState<boolean>(true);

  // State to store the initial duration of a countdown timer session. Useful for calculating progress and study time.
  const [initialCountdownDuration, setInitialCountdownDuration] = useState<number>(0);
  // State to store the total study time completed before a pause, used when entering a break.
  const [prePauseStudySeconds, setPrePauseStudySeconds] = useState<number>(0);

  // useRef to store the ID of the setInterval, allowing it to be cleared when needed.
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Predefined durations for Pomodoro, Reverse Pomodoro, and their respective breaks, in seconds.
  const presets = {
    pomodoro: 25 * 60, // 25 minutes for a standard Pomodoro study session.
    reversePomodoro: 5 * 60, // 5 minutes for a Reverse Pomodoro study session.
    pomodoroBreak: 5 * 60, // 5 minutes for the break after a standard Pomodoro.
    reversePomodoroBreak: 25 * 60, // 25 minutes for the break after a Reverse Pomodoro.
  };

  // --- Initial Data Fetching Effect ---
  // This useEffect hook runs once when the component mounts to load user preferences (subjects and their colors).
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true); // Set loading state to true while fetching.
        // Fetch user preferences, including subjects and their associated colors.
        const prefRes = await fetch('/api/user/preferences');
        const prefData = await prefRes.json(); // Parse the JSON response.

        // Validate the response data. Ensure it's OK and contains expected array/object types.
        if (!prefRes.ok || !Array.isArray(prefData.subjects) || typeof prefData.subjectcolors !== 'object') {
          throw new Error(prefData.message || 'Failed to load user preferences.');
        }

        // Update the state with the fetched subjects and their colors.
        setSubjects(prefData.subjects);
        setSubjectColorsMap(prefData.subjectcolors);

        // If subjects are available, set the first one as the default selected subject.
        if (prefData.subjects.length > 0) {
          setSubject(prefData.subjects[0]);
        }
      } catch (err: any) {
        console.error('Error fetching initial timer data:', err); // Log the error for debugging.
        // Display an alert to the user if data loading fails.
        alert(`Failed to load necessary data: ${err.message}. Please try again.`);
        // In a real application, you might also consider redirecting the user or showing a dedicated error screen here.
      } finally {
        setLoading(false); // Set loading to false regardless of success or failure.
      }
    };

    fetchInitialData(); // Call the async function to fetch data.
  }, []); // Empty dependency array means this effect runs only once on component mount.

  // --- Timer Initialization/Reset Effect ---
  // This effect runs when the 'mode' or 'customMinutes' change, or when the timer is stopped or break ends.
  useEffect(() => {
    // Only reset the timer if it's not currently running and not on a break.
    if (!timerRunning && !onBreak) {
      if (mode === 'stopwatch') {
        // For stopwatch, ensure both countdown and initial duration are zero, reset stopwatch.
        setStopwatchSeconds(0);
        setCountdownTimeLeft(0);
        setInitialCountdownDuration(0);
      } else {
        // For countdown modes (Pomodoro, Reverse Pomodoro, Custom).
        let durationToSet = 0;
        if (mode === 'pomodoro') {
          durationToSet = presets.pomodoro;
        } else if (mode === 'reversePomodoro') {
          durationToSet = presets.reversePomodoro;
        } else if (mode === 'custom') {
          // Parse custom minutes, ensuring it's a valid number and capped at 180 minutes.
          durationToSet = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);
          // If custom time is invalid (0 or less after parsing, but input was not empty), alert the user and reset.
          if (durationToSet <= 0 && customMinutes !== '') {
            alert('Invalid custom time. Please enter 1-180 minutes.');
            setCustomMinutes(''); // Clear the invalid custom input.
          }
        }
        // Set the countdown time and initial duration.
        setCountdownTimeLeft(durationToSet);
        setInitialCountdownDuration(durationToSet);
        // Ensure stopwatch seconds are zero for countdown modes.
        setStopwatchSeconds(0);
      }
      setPrePauseStudySeconds(0); // Reset pre-pause study time.
    }
  }, [mode, customMinutes, timerRunning, onBreak, presets.pomodoro, presets.reversePomodoro]);


  // --- Unified Function to Save Study Time (Memoized with useCallback) ---
  // This function handles sending the completed study duration to the backend.
  const handleSaveStudyTime = useCallback(async (seconds: number) => {
    // Get today's date in YYYY-MM-DD format.
    const today = new Date().toISOString().split('T')[0];
    // Convert seconds to hours and round to one decimal place.
    const roundedHours = Math.round((seconds / 3600) * 10) / 10;

    // Do not save if study time is zero or less, or if no subject is selected.
    if (roundedHours <= 0 || !subject) {
      console.warn('Skipping save: No valid study time or subject selected.');
      return;
    }

    try {
      // Make a POST request to save study hours.
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
        // If the save operation failed, parse the error and throw.
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save study hours.');
      }
      console.log(`Saved ${roundedHours} hours for ${subject} on ${today}`); // Log success.
    } catch (err: any) {
      console.error('Error saving study hours:', err); // Log error.
      alert(`Error saving study time: ${err.message}`); // Alert user about the error.
    }
  }, [subject]); // This function depends on the 'subject' state.

  // --- Handle Stop Timer (Memoized with useCallback) ---
  // This function stops any active timer, calculates study time, and saves it.
  const handleStop = useCallback(async () => {
    // Clear the interval if it's running to stop the timer.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerRunning(false); // Set timer running state to false.
    setOnBreak(false); // Ensure not on break.

    let secondsStudied = 0;
    // Calculate seconds studied based on the current mode.
    if (mode === 'stopwatch') {
      secondsStudied = stopwatchSeconds;
    } else if (initialCountdownDuration > 0) {
      // For countdowns, calculate based on the difference between initial duration and remaining time.
      secondsStudied = Math.max(0, initialCountdownDuration - countdownTimeLeft);
    }

    // Call the memoized function to save the study time.
    await handleSaveStudyTime(secondsStudied);

    // Reset timer-related states to their initial values for a fresh start.
    setCountdownTimeLeft(0);
    setStopwatchSeconds(0);
    setPrePauseStudySeconds(0);

  }, [mode, stopwatchSeconds, initialCountdownDuration, countdownTimeLeft, handleSaveStudyTime]); // Dependencies for this callback.

  // --- Handle Start Timer (Memoized with useCallback) ---
  // This function starts the timer based on the selected mode.
  const handleStart = useCallback(() => {
    // Prevent starting if no subject is selected.
    if (!subject) {
      alert('Please select a subject before starting the timer.');
      return;
    }
    // Validate custom time input if in 'custom' mode.
    if (mode === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0)) {
      alert('Please enter a valid custom time (1-180 minutes).');
      return;
    }
    // Prevent starting if the timer is already running.
    if (timerRunning) return;

    // Determine and set the initial duration for countdown timers if not already set or restarting.
    let currentInitialDuration = initialCountdownDuration;
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
        setInitialCountdownDuration(0); // Stopwatch has no fixed initial duration.
        if (stopwatchSeconds === 0) { // Reset if starting fresh.
            setStopwatchSeconds(0);
        }
    }

    setOnBreak(false); // Ensure the timer is not in break mode.
    setTimerRunning(true); // Start the main study timer. This will trigger the main `useEffect` for the interval.

  }, [subject, timerRunning, mode, customMinutes, countdownTimeLeft, initialCountdownDuration, presets.pomodoro, presets.reversePomodoro]); // Dependencies for this callback.

  // --- Handle Pause Timer (Memoized with useCallback) ---
  // This function pauses the timer and transitions to a break session if applicable.
  const handlePause = useCallback(async () => {
    // Only pause if the timer is running and not already on a break.
    if (!timerRunning || onBreak) return;

    // Clear the active interval to stop the timer.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerRunning(false); // Set timer running state to false.

    let currentSessionStudyTime = 0;
    // Calculate the study time completed in the current session.
    if (mode === 'stopwatch') {
      currentSessionStudyTime = stopwatchSeconds;
    } else { // For countdown modes
      currentSessionStudyTime = initialCountdownDuration - countdownTimeLeft;
    }

    // Calculate a break duration (one-third of study time).
    const breakDuration = Math.floor(currentSessionStudyTime / 3);

    if (breakDuration > 0) {
      setBreakTimeLeft(breakDuration); // Set the break time.
      setOnBreak(true); // Activate break mode. This will trigger the main `useEffect` for the break timer.
      setPrePauseStudySeconds(currentSessionStudyTime); // Store study time before break.
    } else {
      // If no break duration, save the study time immediately and reset.
      await handleSaveStudyTime(currentSessionStudyTime);
      setCountdownTimeLeft(0);
      setStopwatchSeconds(0);
      setPrePauseStudySeconds(0);
      setOnBreak(false);
    }
  }, [timerRunning, onBreak, mode, stopwatchSeconds, initialCountdownDuration, countdownTimeLeft, handleSaveStudyTime]); // Dependencies for this callback.

  // --- NEW: Unified Timer & Break Interval Management Effect ---
  // This critical useEffect manages the countdowns for both study sessions and breaks.
  useEffect(() => {
    // First, clear any existing interval to prevent multiple timers running simultaneously.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up a new interval if either the study timer is running OR the user is on a break.
    if (timerRunning || onBreak) {
      intervalRef.current = setInterval(() => {
        if (onBreak) {
          // Logic for when the timer is in a break session.
          setBreakTimeLeft(prev => {
            if (prev <= 1) {
              // If break time is almost up (1 second or less remaining).
              clearInterval(intervalRef.current!); // Stop the interval.
              intervalRef.current = null;
              setOnBreak(false); // End the break session.
              handleSaveStudyTime(prePauseStudySeconds); // Save the study time that led to this break.
              setPrePauseStudySeconds(0); // Reset pre-pause study seconds.

              // Prepare for the next study session based on the current mode.
              let nextStudyDuration = 0;
              if (mode === 'pomodoro') nextStudyDuration = presets.pomodoro;
              else if (mode === 'reversePomodoro') nextStudyDuration = presets.reversePomodoro;
              else if (mode === 'custom') nextStudyDuration = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);

              // Reset countdown and initial duration only if not stopwatch and duration is valid.
              if (mode !== 'stopwatch' && nextStudyDuration > 0) {
                setCountdownTimeLeft(nextStudyDuration);
                setInitialCountdownDuration(nextStudyDuration);
              }
              setStopwatchSeconds(0); // Always reset stopwatch seconds.

              // Automatically start the next study session after a short delay.
              // The delay helps ensure state updates are fully processed before restarting the timer logic.
              setTimeout(() => {
                setTimerRunning(true); // This will re-trigger this same useEffect to start the next study interval.
              }, 50); // A very short delay.

              return 0; // Set breakTimeLeft to 0.
            }
            return prev - 1; // Decrement break time by one second.
          });
        } else if (timerRunning) { // If not on break, and the study timer is actively running.
          if (mode === 'stopwatch') {
            setStopwatchSeconds(s => s + 1); // Increment stopwatch seconds.
          } else { // For countdown modes (Pomodoro, Reverse Pomodoro, Custom).
            setCountdownTimeLeft(prev => {
              if (prev <= 1) {
                // If study session time is almost up.
                clearInterval(intervalRef.current!); // Stop the interval.
                intervalRef.current = null;
                setTimerRunning(false); // Stop the study timer.

                const actualStudyTimeCompleted = initialCountdownDuration; // The full duration of the session.

                let breakDuration = 0;
                // Determine the duration of the upcoming break based on the mode.
                if (mode === 'pomodoro') breakDuration = presets.pomodoroBreak;
                else if (mode === 'reversePomodoro') breakDuration = presets.reversePomodoroBreak;
                else if (mode === 'custom') breakDuration = Math.floor(actualStudyTimeCompleted / 3); // Custom break is 1/3 of study time.

                if (breakDuration > 0) {
                  setBreakTimeLeft(breakDuration); // Set the break time.
                  setOnBreak(true); // Transition to break mode, which will re-trigger this useEffect.
                  setPrePauseStudySeconds(actualStudyTimeCompleted); // Store the completed study time.
                } else {
                  // If no break is needed, save study time directly and reset for the next session.
                  handleSaveStudyTime(actualStudyTimeCompleted);
                  setStopwatchSeconds(0); // Reset stopwatch if applicable.

                  // Reset countdown and initial duration for the next study session.
                  let nextStudyDuration = 0;
                  if (mode === 'pomodoro') nextStudyDuration = presets.pomodoro;
                  else if (mode === 'reversePomodoro') nextStudyDuration = presets.reversePomodoro;
                  else if (mode === 'custom') nextStudyDuration = Math.min(parseInt(customMinutes) * 60 || 0, 180 * 60);

                  setCountdownTimeLeft(nextStudyDuration);
                  setInitialCountdownDuration(nextStudyDuration);
                  setPrePauseStudySeconds(0);
                  setOnBreak(false); // Ensure not on break.
                }
                return 0; // Set countdownTimeLeft to 0.
              }
              return prev - 1; // Decrement countdown time by one second.
            });
          }
        }
      }, 1000); // The interval runs every 1000 milliseconds (1 second).
    }

    // Cleanup function: This runs when the component unmounts or when any of the dependencies change.
    // It's crucial for preventing memory leaks and ensuring only one interval runs at a time.
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current); // Clear the active interval.
        intervalRef.current = null; // Reset the ref.
      }
    };
  }, [
    timerRunning, // Re-run effect when study timer starts/stops.
    onBreak, // Re-run effect when break starts/ends.
    mode, // Re-run effect when timer mode changes.
    customMinutes, // Re-run effect when custom minutes change.
    initialCountdownDuration, // To capture the correct duration at the start of a session.
    prePauseStudySeconds, // To correctly use the study time before a break.
    handleSaveStudyTime, // The memoized save function.
    presets.pomodoro, // Presets used in calculation.
    presets.reversePomodoro,
    presets.pomodoroBreak,
    presets.reversePomodoroBreak,
  ]);


  // --- Subject Management (Memoized with useCallback) ---
  // This function handles adding a new subject and saving it to user preferences.
  const handleAddSubject = useCallback(async () => {
    const name = newSubject.trim().toLowerCase(); // Sanitize and normalize the new subject name.
    if (!name) {
      alert('Subject name cannot be empty.');
      return;
    }
    if (subjects.includes(name)) {
      alert('Subject already exists.');
      return;
    }
    // Check if the chosen color is already in use by another subject.
    if (Object.values(subjectColorsMap).some(color => color.toLowerCase() === newColor.toLowerCase())) {
        alert('Color already in use. Please choose a different one.');
        return;
    }

    // Prepare updated lists for subjects and colors map.
    const updatedSubjects = [...subjects, name];
    const updatedColors = { ...subjectColorsMap, [name]: newColor };

    // Optimistic UI update: update the state immediately to provide quick feedback to the user.
    setSubjects(updatedSubjects);
    setSubjectColorsMap(updatedColors);

    // Automatically select the newly added subject if no subject was previously selected.
    if (!subject || subjects.length === 0) {
      setSubject(name);
    }

    setNewSubject(''); // Clear the input field for the new subject.
    setNewColor('#f97316'); // Reset the color picker to a default.

    try {
      // Send a POST request to update user preferences on the backend.
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
      });
      if (!res.ok) {
        // If the API call fails, revert the UI state to its previous condition.
        setSubjects(subjects);
        setSubjectColorsMap(subjectColorsMap);
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save preferences.');
      }
      console.log('Subject added:', name); // Log success.
    } catch (err: any) {
      console.error('Failed to add subject:', err); // Log error.
      alert(`Failed to add subject: ${err.message}. Please try again.`); // Alert user.
    }
  }, [newSubject, subjects, newColor, subjectColorsMap, subject]); // Dependencies for this callback.

  // --- Helper for Time Formatting ---
  // This utility function formats a number of seconds into "MM:SS" string format.
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0'); // Calculate minutes and pad with leading zero.
    const s = (sec % 60).toString().padStart(2, '0'); // Calculate seconds and pad with leading zero.
    return `${m}:${s}`; // Return formatted string.
  };

  // --- Dynamic Display Values ---
  // Determines which time to display (stopwatch elapsed time or countdown remaining time).
  const displayTime = mode === 'stopwatch'
    ? formatTime(stopwatchSeconds)
    : formatTime(countdownTimeLeft);

  // Calculates the total duration for the progress bar's context (either study session or break session).
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
    totalForProgressBar = initialCountdownDuration; // Use the initial duration set for the custom session.
  }

  // Calculates the progress percentage for the circular progress bar (from 0 to 1).
  const progress = onBreak
    ? (totalForProgressBar > 0 ? (totalForProgressBar - breakTimeLeft) / totalForProgressBar : 0) // Progress for break.
    : mode === 'stopwatch'
      ? (stopwatchSeconds / (180 * 60)) > 1 ? 1 : (stopwatchSeconds / (180 * 60)) // Progress for stopwatch, capped at 180 minutes.
      : (totalForProgressBar > 0 ? (totalForProgressBar - countdownTimeLeft) / totalForProgressBar : 0); // Progress for countdown modes.


  // --- Loading UI ---
  // Displays a loading message while initial data is being fetched.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 text-orange-600">
        <p className="text-xl">Loading timer settings...</p>
      </div>
    );
  }

  // The main rendering of the Study Timer page.
  return (
    // Main container div for the entire page, providing background, text color, padding, and flex layout.
    <div className="min-h-screen bg-orange-50 text-white px-4 py-6 md:px-8 lg:px-16 flex flex-col gap-6">
      {/* Button to navigate back to the dashboard. */}
      <div className="self-start">
        <Link href="/dashboard">
          <button className="text-base md:text-xl px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600 transition">
            Go To Dashboard
          </button>
        </Link>
      </div>

      {/* Page title. */}
      <h1 className="text-2xl md:text-3xl text-black font-bold text-center">Study Timer</h1>

      {/* Mode Selection Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        {/* Map over the different timer modes to create a button for each. */}
        {['pomodoro', 'reversePomodoro', 'custom', 'stopwatch'].map(m => (
          <button
            key={m} // Unique key for list rendering.
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === m ? 'bg-orange-500' : 'bg-gray-700 hover:bg-gray-600' // Dynamic styling based on active mode.
            }`}
            onClick={() => {
              // When a mode button is clicked, reset all relevant timer states.
              setMode(m as any); // Set the new mode.
              setOnBreak(false); // End break mode.
              setTimerRunning(false); // Stop the timer.
              setStopwatchSeconds(0); // Reset stopwatch.
              setCountdownTimeLeft(0); // Reset countdown (useEffect will re-initialize based on new mode).
              setInitialCountdownDuration(0); // Reset initial duration.
              setPrePauseStudySeconds(0); // Reset pre-pause study seconds.
              if (intervalRef.current) {
                clearInterval(intervalRef.current); // Clear any active interval.
                intervalRef.current = null;
              }
            }}
          >
            {/* Format button text for better display (e.g., "Pomodoro", "Reverse Pomodoro"). */}
            {m.charAt(0).toUpperCase() + m.slice(1).replace('pomodoro', ' Pomodoro')}
          </button>
        ))}
      </div>

      {/* Subject Selector */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3">
        <label className="text-black">Subject:</label>
        <select
          className="text-black px-2 py-1 rounded w-full md:w-auto border border-black"
          value={subject} // Controlled component: value is tied to 'subject' state.
          onChange={e => setSubject(e.target.value)} // Update 'subject' state on change.
          disabled={subjects.length === 0} // Disable the dropdown if no subjects are loaded.
        >
          {subjects.length > 0 ? (
            // Map over available subjects to create options for the dropdown.
            subjects.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))
          ) : (
            // Display a disabled option if no subjects are found.
            <option value="" disabled>No subjects added</option>
          )}
        </select>
      </div>

      {/* Custom Timer Input Field (conditionally rendered for 'custom' mode) */}
      {mode === 'custom' && (
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-black">
          <label className="text-black">Minutes (1–180)</label>
          <input
            className="text-black px-2 py-1 border border-black rounded w-24"
            type="number"
            value={customMinutes} // Controlled component for custom minutes.
            onChange={e => setCustomMinutes(e.target.value)} // Update 'customMinutes' state.
            min="1" // Minimum allowed value.
            max="180" // Maximum allowed value.
          />
        </div>
      )}

      {/* Timer Progress Circle Display and "On Break" text */}
      <div className="flex items-center justify-center gap-4">
        <div className="w-64 h-64"> {/* Fixed size container for the CircularProgressbar. */}
          <CircularProgressbar
            value={progress * 100} // Progress value from 0 to 100.
            text={onBreak ? `Break: ${formatTime(breakTimeLeft)}` : displayTime} // Dynamic text based on whether it's a break or study time.
            styles={{
              // Inline styles for text positioning.
              text: {
                dominantBaseline: 'middle',
                textAnchor: 'middle',
              },
              // Styles for the progress bar itself, using `buildStyles` from react-circular-progressbar.
              ...buildStyles({
                // Path color changes based on break status or selected subject's color.
                pathColor: onBreak ? '#60a5fa' : subjectColorsMap[subject] || '#f97316',
                // Text color matches path color.
                textColor: onBreak ? '#60a5fa' : subjectColorsMap[subject] || '#f97316',
                trailColor: '#374151', // Color of the background path.
                textSize: '18px',
              }),
            }}
          />
        </div>
      </div>

      {/* Start / Stop / Pause Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {/* "Start" button: Shown only if the timer is not running and not on break. */}
        {!timerRunning && !onBreak && (
          <button
            className="px-6 py-2 bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            onClick={handleStart} // Calls the handleStart function when clicked.
            // Button is disabled under these conditions:
            disabled={
              loading || // Still loading initial data.
              !subject || // No subject has been selected.
              (mode === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0)) // Custom mode with invalid time.
            }
          >
            Start
          </button>
        )}
        {/* Buttons shown when the timer is running (either study or break). */}
        {timerRunning && (
          <>
            {/* "Pause" button: Only shown for Custom and Stopwatch modes during study. */}
            {(mode === 'custom' || mode === 'stopwatch') && (
              <button className="px-6 py-2 bg-yellow-500 rounded-xl hover:bg-yellow-600 transition" onClick={handlePause}>
                Pause
              </button>
            )}
            {/* "Stop" button: Always shown when timer is running (study). */}
            <button className="px-6 py-2 bg-red-600 rounded-xl hover:bg-red-700 transition" onClick={handleStop}>
              Stop
            </button>
          </>
        )}
        {/* "Stop Break & Save" button: Shown only when on break. */}
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
          value={newSubject} // Controlled input for new subject name.
          onChange={e => setNewSubject(e.target.value)} // Update state on change.
          className="w-full mb-2 px-2 py-1 rounded text-white bg-gray-700 border border-gray-600"
        />
        <input
          type="color"
          value={newColor} // Controlled input for new subject color.
          onChange={e => setNewColor(e.target.value)} // Update state on change.
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
            value={subject} // Uses the currently selected subject for deletion.
            onChange={e => setSubject(e.target.value)} // Allows selecting a subject to delete.
            className="text-white bg-gray-800 px-2 py-1 rounded w-full md:w-auto border border-gray-600"
            disabled={subjects.length === 0} // Disable if no subjects exist to delete.
          >
            {subjects.length > 0 ? (
              // Map through subjects to create options for deletion.
              subjects.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))
            ) : (
              <option value="" disabled>No subjects to delete</option>
            )}
          </select>
          <button
            onClick={async () => {
              // Basic validation before attempting deletion.
              if (!subject) {
                alert('Please select a subject to delete.');
                return;
              }
              // Confirmation dialog before deleting a subject.
              if (!confirm(`Are you sure you want to delete the subject "${subject}"? This cannot be undone and will affect associated graphs.`)) {
                return;
              }

              // Filter out the subject to be deleted from the subjects array.
              const updatedSubjects = subjects.filter(s => s !== subject);
              // Create a new color map without the deleted subject's color.
              const updatedColors = { ...subjectColorsMap };
              delete updatedColors[subject];

              // Optimistic UI update: remove the subject from display immediately.
              setSubjects(updatedSubjects);
              setSubjectColorsMap(updatedColors);
              setSubject(updatedSubjects[0] || ''); // Set a new default subject or empty string if none remain.

              try {
                // Send a POST request to update user preferences on the backend after deletion.
                const res = await fetch('/api/user/preferences', {
                  method: 'POST', // Assuming POST handles general preference updates.
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subjects: updatedSubjects, subjectcolors: updatedColors }),
                });
                if (!res.ok) {
                  // If deletion fails on the backend, revert the UI state.
                  setSubjects(subjects);
                  setSubjectColorsMap(subjectColorsMap);
                  setSubject(subject);
                  const errorData = await res.json();
                  throw new Error(errorData.error || 'Failed to delete subject.');
                }
                console.log('Subject deleted:', subject); // Log success.
              } catch (err: any) {
                console.error('Failed to delete subject:', err); // Log error.
                alert(`Failed to delete subject: ${err.message}.`); // Alert user.
              }
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!subject || subjects.length === 0} // Disable if no subject is selected or no subjects exist.
          >
            Delete Selected
          </button>
        </div>
      </div>
    </div>
  );
}
