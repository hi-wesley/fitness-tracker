import {
  addDaysToKey,
  avg,
  clamp,
  clamp01,
  formatNumber,
  formatSigned,
  isFiniteNumber,
  isPlainObject,
  stddev,
  toNumber,
} from "./utils.js";

function windowDays(dayByKey, endDayKey, length) {
  const out = [];
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    const dayKey = addDaysToKey(endDayKey, -offset);
    out.push(dayByKey.get(dayKey) ?? { dayKey });
  }
  return out;
}

const DEFAULT_CONFIG = Object.freeze({
  baselineLookbackDays: 14,
  baselineMinPoints: 5,
  stressZToFull: 2.0,
  stressPctToFull: 0.2,
  stressLowMax: 33,
  stressModerateMax: 66,
});

function getConfig(config) {
  if (!isPlainObject(config)) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

function computeBaselineStats(dayByKey, endDayKey, metricKey, config) {
  const cfg = getConfig(config);
  const window = windowDays(dayByKey, endDayKey, cfg.baselineLookbackDays);
  const values = window.map((d) => d?.[metricKey]).filter(isFiniteNumber);
  if (values.length < cfg.baselineMinPoints) return null;
  const mean = avg(values);
  const sd = stddev(values);
  return mean === null ? null : { mean, sd: isFiniteNumber(sd) ? sd : null, n: values.length };
}

function computeStressPenalty(value, baseline, direction, config) {
  const cfg = getConfig(config);
  if (!isFiniteNumber(value) || !baseline || !isFiniteNumber(baseline.mean)) return null;
  const diff = value - baseline.mean;

  if (isFiniteNumber(baseline.sd) && baseline.sd > 0) {
    const z = diff / baseline.sd;
    const signedZ = direction === "lower_worse" ? -z : z;
    const penalty = clamp01(signedZ / cfg.stressZToFull);
    return { penalty, diff, method: "z" };
  }

  if (baseline.mean > 0) {
    const pct = diff / baseline.mean;
    const signedPct = direction === "lower_worse" ? -pct : pct;
    const penalty = clamp01(signedPct / cfg.stressPctToFull);
    return { penalty, diff, method: "pct" };
  }

  return null;
}

function computeAbsoluteStressPenalty(value, direction, absolute) {
  if (!isFiniteNumber(value) || !isPlainObject(absolute)) return null;
  const threshold = toNumber(absolute.threshold);
  const full = toNumber(absolute.full);
  if (!isFiniteNumber(threshold) || !isFiniteNumber(full)) return null;

  if (direction === "lower_worse") {
    const span = threshold - full;
    if (span <= 0) return null;
    if (value >= threshold) return 0;
    return clamp01((threshold - value) / span);
  }
  if (direction === "higher_worse") {
    const span = full - threshold;
    if (span <= 0) return null;
    if (value <= threshold) return 0;
    return clamp01((value - threshold) / span);
  }
  return null;
}

export function labelStressScore(score, config) {
  const cfg = getConfig(config);
  if (!isFiniteNumber(score)) return null;
  if (score <= cfg.stressLowMax) return "Low";
  if (score <= cfg.stressModerateMax) return "Moderate";
  return "High";
}

export function stressHueForScore(score) {
  if (!isFiniteNumber(score)) return null;
  const clamped = clamp(score, 0, 100);
  return (clamped / 100) * 120;
}

export function stressColorForScore(score) {
  const hue = stressHueForScore(score);
  if (hue === null) return "#FF3B30";
  return `hsl(${Math.round(hue)}, 78%, 45%)`;
}

const STRESS_INPUTS = Object.freeze([
  {
    key: "sleep_hours",
    label: "Sleep",
    unit: "h",
    digits: 1,
    direction: "lower_worse",
    weight: 0.4,
    absolute: { threshold: 6.5, full: 4.5 },
  },
  {
    key: "rhr_bpm",
    label: "Resting HR",
    unit: "bpm",
    digits: 0,
    direction: "higher_worse",
    weight: 0.4,
    absolute: { threshold: 60, full: 78 },
  },
  {
    key: "workout_load",
    label: "Exercise load",
    unit: "au",
    digits: 0,
    direction: "higher_worse",
    weight: 0.2,
    absolute: { threshold: 110, full: 220 },
  },
]);

export function computeStressForDay(dayByKey, dayKey, config) {
  const cfg = getConfig(config);
  const day = dayByKey.get(dayKey) ?? { dayKey };
  const baselineEndKey = addDaysToKey(dayKey, -1);

  let usedWeight = 0;
  let weightedPenalty = 0;
  const rows = [];
  const missingValues = [];
  const missingBaselines = [];

  for (const input of STRESS_INPUTS) {
    const value = day?.[input.key];
    if (!isFiniteNumber(value)) {
      missingValues.push(input.label);
      continue;
    }

    const baseline = computeBaselineStats(dayByKey, baselineEndKey, input.key, cfg);
    if (!baseline) {
      missingBaselines.push(input.label);
      rows.push({
        label: input.label,
        value: `${formatNumber(value, input.digits)} ${input.unit} (baseline building…)`,
      });
      continue;
    }

    const penalty = computeStressPenalty(value, baseline, input.direction, cfg);
    if (!penalty) {
      missingBaselines.push(input.label);
      rows.push({
        label: input.label,
        value: `${formatNumber(value, input.digits)} ${input.unit} (baseline: ${formatNumber(
          baseline.mean,
          input.digits
        )} ${input.unit})`,
      });
      continue;
    }

    const absolutePenalty = computeAbsoluteStressPenalty(value, input.direction, input.absolute);
    const mergedPenalty =
      isFiniteNumber(absolutePenalty) && absolutePenalty > penalty.penalty
        ? { ...penalty, penalty: absolutePenalty, method: `${penalty.method}+abs` }
        : penalty;

    usedWeight += input.weight;
    weightedPenalty += input.weight * mergedPenalty.penalty;

    const diffLabel = `${formatSigned(mergedPenalty.diff, input.digits)} ${input.unit}`;
    rows.push({
      label: input.label,
      value: `${formatNumber(value, input.digits)} ${input.unit} (Δ ${diffLabel})`,
    });
  }

  if (usedWeight <= 0) {
    return { dayKey, score: null, label: null, rows, missingValues, missingBaselines };
  }

  const stress = Math.round((weightedPenalty / usedWeight) * 100);
  const score = clamp(100 - stress, 0, 100);
  const label = labelStressScore(score, cfg);
  return { dayKey, score, label, rows, missingValues, missingBaselines };
}
