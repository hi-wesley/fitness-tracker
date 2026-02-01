export function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function avg(nums) {
  if (nums.length === 0) return null;
  let sum = 0;
  for (const n of nums) sum += n;
  return sum / nums.length;
}

export function stddev(nums) {
  if (nums.length === 0) return null;
  const mean = avg(nums);
  if (mean === null) return null;
  let variance = 0;
  for (const v of nums) variance += (v - mean) ** 2;
  variance /= nums.length;
  return Math.sqrt(variance);
}

export function formatNumber(value, digits) {
  if (!isFiniteNumber(value)) return "—";
  return value.toFixed(digits);
}

export function formatSigned(value, digits) {
  if (!isFiniteNumber(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function addDaysToKey(dayKey, days) {
  const dt = new Date(`${dayKey}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
