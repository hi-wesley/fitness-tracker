import { isPlainObject } from "../utils.js";

export const STORAGE_VERSION = 1;
export const STORAGE_KEYS = Object.freeze({
  activeProfile: `mhp.activeProfile.v${STORAGE_VERSION}`,
  samplePrefix: `mhp.sample.v${STORAGE_VERSION}:`,
  insightsPrefix: `mhp.insights.v${STORAGE_VERSION}:`,
});

export function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStoredJson(key) {
  const raw = safeStorageGet(key);
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStoredJson(key, value) {
  try {
    return safeStorageSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

function isDayKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getStoredActiveProfile() {
  const raw = safeStorageGet(STORAGE_KEYS.activeProfile);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function setStoredActiveProfile(profileId) {
  if (typeof profileId !== "string" || !profileId.trim()) return false;
  return safeStorageSet(STORAGE_KEYS.activeProfile, profileId.trim());
}

function sampleStateKey(profileId) {
  return `${STORAGE_KEYS.samplePrefix}${profileId}`;
}

export function getSampleState(profileId, { expectedSampleVersion } = {}) {
  const stored = readStoredJson(sampleStateKey(profileId));
  if (!isPlainObject(stored)) return null;
  if (stored.v !== STORAGE_VERSION) return null;
  if (typeof expectedSampleVersion === "number" && stored.sampleVersion !== expectedSampleVersion) return null;
  if (stored.profileId !== profileId) return null;
  if (!isDayKey(stored.startDayKey)) return null;
  if (!isDayKey(stored.lastDayKey)) return null;
  if (!isPlainObject(stored.payload)) return null;
  if (!Array.isArray(stored.payload.records)) return null;
  return stored;
}

export function putSampleState(profileId, state) {
  if (!isPlainObject(state)) return false;
  return writeStoredJson(sampleStateKey(profileId), state);
}

function insightsCacheKey(profileId, dayKey) {
  return `${STORAGE_KEYS.insightsPrefix}${profileId}:${dayKey}`;
}

export function clearCachedInsights(profileId, dayKey) {
  return safeStorageRemove(insightsCacheKey(profileId, dayKey));
}

export function getCachedInsights(profileId, dayKey) {
  const stored = readStoredJson(insightsCacheKey(profileId, dayKey));
  if (!isPlainObject(stored)) return null;
  if (stored.v !== STORAGE_VERSION) return null;
  if (stored.profileId !== profileId) return null;
  if (stored.dayKey !== dayKey) return null;
  if (!isPlainObject(stored.insights)) return null;
  return stored;
}

export function putCachedInsights(profileId, dayKey, entry) {
  const payload = isPlainObject(entry) ? entry : {};
  return writeStoredJson(insightsCacheKey(profileId, dayKey), {
    ...payload,
    v: STORAGE_VERSION,
    profileId,
    dayKey,
    generatedAt: new Date().toISOString(),
  });
}

