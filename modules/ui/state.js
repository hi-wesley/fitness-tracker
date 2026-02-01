export const CONFIG = {
  shortSleepHours: 6,
  enoughSleepMinHours: 7,
  enoughSleepMaxHours: 9,
  enoughExerciseAvgMinutes: 20,
  baselineLookbackDays: 14,
  baselineMinPoints: 5,
  zScoreThreshold: 2.0,
  rhrElevationSd: 1.5,
  rhrStreakDays: 3,
  stressZToFull: 2.0,
  stressPctToFull: 0.2,
  stressLowMax: 33,
  stressModerateMax: 66,
};

export const METRICS = {
  sleep_hours: { label: "Sleep", unit: "h", kind: "bar", color: "#1E3A8A" }, // deep blue
  sugar_g: { label: "Sugar", unit: "g", kind: "bar", color: "#FF2D55" }, // systemPink
  workout_minutes: { label: "Exercise", unit: "min", kind: "bar", color: "#F59E0B" }, // amber
  workout_load: { label: "Training load", unit: "au", kind: "line", color: "#F59E0B" }, // amber
  rhr_bpm: { label: "Resting HR", unit: "bpm", kind: "line", color: "#FF3B30" }, // systemRed
  weight_kg: { label: "Weight", unit: "lb", kind: "line", color: "#C4B5FD" }, // light purple
  steps: { label: "Steps", unit: "steps", kind: "line", color: "#5AC8FA" }, // systemTeal
  calories: { label: "Calories", unit: "Cal", kind: "line", color: "#14B8A6" }, // teal
  protein_g: { label: "Protein", unit: "g", kind: "line", color: "#007AFF" }, // systemBlue
};

export const FOCUS_RANGE_DEFAULTS = Object.freeze({
  sleep: 7,
  exercise: 7,
  stress: 1,
  nutrition: 1,
  weight: 30,
  bp: 7,
});

export const FOCUS_RANGE_OPTIONS = Object.freeze({
  sleep: [1, 7, 30],
  exercise: [1, 7, 30],
  stress: [1, 7, 30],
  nutrition: [1, 7, 30],
  weight: [7, 14, 30],
  bp: [7, 14, 30],
});

