import "dotenv/config";
import cors from "cors";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const NODE_ENV = (process.env.NODE_ENV || "development").trim();
const IS_PROD = NODE_ENV === "production";
const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-5.2").trim();
const ANALYSIS_VERSION = 1;
const corsOriginRaw = (process.env.CORS_ORIGIN || "*").trim();
const corsOrigin =
  corsOriginRaw === "*"
    ? "*"
    : corsOriginRaw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function extractJsonObject(text) {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeInsightTextBlock(value) {
  if (!isPlainObject(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  if (!title || !body) return null;
  return { title, body };
}

function normalizeInsightsText(value) {
  if (!isPlainObject(value)) return null;
  const out = {
    overall: normalizeInsightTextBlock(value.overall),
    sleep: normalizeInsightTextBlock(value.sleep),
    stress: normalizeInsightTextBlock(value.stress),
    exercise: normalizeInsightTextBlock(value.exercise),
    nutrition: normalizeInsightTextBlock(value.nutrition),
    bp: normalizeInsightTextBlock(value.bp),
    weight: normalizeInsightTextBlock(value.weight),
  };
  if (!out.overall || !out.sleep || !out.stress || !out.exercise || !out.nutrition || !out.bp || !out.weight) {
    return null;
  }
  return out;
}

function getRawError(err) {
  if (!err || typeof err !== "object") return null;
  const raw = err.raw;
  return typeof raw === "string" ? raw : null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(WEB_ROOT));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: OPENAI_MODEL,
    },
  });
});

const INSIGHTS_JOBS_TTL_MS = 15 * 60 * 1000;
const INSIGHTS_JOBS_CLEANUP_INTERVAL_MS = 60 * 1000;
const insightsJobs = new Map();

const INSIGHTS_PROXY_SECRET = (process.env.INSIGHTS_PROXY_SECRET || "").trim();
const INSIGHTS_AUTH_HEADER = "x-mhp-proxy-secret";
const INSIGHTS_INCLUDE_RAW = !IS_PROD && (process.env.INSIGHTS_INCLUDE_RAW || "").trim() !== "0";

function getClientIp(req) {
  const ip = typeof req.ip === "string" ? req.ip : "";
  return ip.trim() || "unknown";
}

function requireInsightsProxyAuth(req, res, next) {
  if (!INSIGHTS_PROXY_SECRET) {
    if (IS_PROD) {
      res.status(500).json({ ok: false, error: "Server misconfigured: missing INSIGHTS_PROXY_SECRET." });
      return;
    }
    return next(); // dev/unsecured mode
  }
  const headerValueRaw = req.get(INSIGHTS_AUTH_HEADER);
  const headerValue = typeof headerValueRaw === "string" ? headerValueRaw.trim() : "";
  if (!headerValue || headerValue !== INSIGHTS_PROXY_SECRET) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  next();
}

function makeFixedWindowLimiter({ windowMs, max, keyPrefix }) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}:${windowStart}`;
    const count = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, count);

    // Best-effort cleanup: keep the map from growing unbounded.
    if (buckets.size > 20_000) {
      for (const k of buckets.keys()) {
        if (!k.endsWith(`:${windowStart}`)) buckets.delete(k);
      }
    }

    if (count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ ok: false, error: "Rate limited. Please retry shortly." });
      return;
    }

    next();
  };
}

const INSIGHTS_RATE_WINDOW_MS = 60_000;
const INSIGHTS_RATE_ANY_PER_MIN = Number.parseInt(process.env.INSIGHTS_RATE_ANY_PER_MIN || "120", 10);
const INSIGHTS_RATE_POST_PER_MIN = Number.parseInt(process.env.INSIGHTS_RATE_POST_PER_MIN || "10", 10);
const INSIGHTS_RATE_GET_PER_MIN = Number.parseInt(process.env.INSIGHTS_RATE_GET_PER_MIN || "60", 10);

const limitInsightsAny = makeFixedWindowLimiter({
  windowMs: INSIGHTS_RATE_WINDOW_MS,
  max: Number.isFinite(INSIGHTS_RATE_ANY_PER_MIN) ? INSIGHTS_RATE_ANY_PER_MIN : 120,
  keyPrefix: "insights_any",
});

const limitInsightsPost = makeFixedWindowLimiter({
  windowMs: INSIGHTS_RATE_WINDOW_MS,
  max: Number.isFinite(INSIGHTS_RATE_POST_PER_MIN) ? INSIGHTS_RATE_POST_PER_MIN : 10,
  keyPrefix: "insights_post",
});

const limitInsightsGet = makeFixedWindowLimiter({
  windowMs: INSIGHTS_RATE_WINDOW_MS,
  max: Number.isFinite(INSIGHTS_RATE_GET_PER_MIN) ? INSIGHTS_RATE_GET_PER_MIN : 60,
  keyPrefix: "insights_get",
});

function logInsightsRequest(req, res, next) {
  const start = Date.now();
  const ip = getClientIp(req);
  res.on("finish", () => {
    const ms = Date.now() - start;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    console.log(`[insights] ${ip} ${method} ${url} -> ${status} (${ms}ms)`);
  });
  next();
}

function makeJobId() {
  const rand = Math.random().toString(36).slice(2);
  return `job_${Date.now().toString(36)}_${rand}`;
}

function pruneInsightsJobs(now = Date.now()) {
  for (const [jobId, job] of insightsJobs.entries()) {
    if (!job || typeof job.createdAt !== "number") {
      insightsJobs.delete(jobId);
      continue;
    }
    if (now - job.createdAt > INSIGHTS_JOBS_TTL_MS) insightsJobs.delete(jobId);
  }
}

setInterval(() => pruneInsightsJobs(), INSIGHTS_JOBS_CLEANUP_INTERVAL_MS).unref?.();

async function generateInsights({ profileId, profileName, dayKey, timeZone, days }) {
  const promptText = [
    "You are generating actionable insights for a fitness dashboard.",
    "Write in a friendly, direct tone.",
    'Format any durations as "7h 46m" (no decimals; no "min" units).',
    "- Learn the user's recent baseline for each metric from the available days (e.g., typical level, range, and variability).",
    "- Detect meaningful deviations (spikes/dips), short trends (2–4 days), and persistent patterns (3+ days).",
    "- For the OVERALL insight, prioritize correlations/relationships between metrics across days.",
    "  Examples of correlation language:",
    "  - 'On days after shorter sleep, your afternoon calories tend to be higher.'",
    "  - 'Higher physiological stress days often line up with higher resting heart rate the next day.'",
    "  - 'When exercise load rises, sleep duration/quality tends to change.'",
    "- For the STRESS card, use `stress_score` (0–100; higher = better recovery/lower stress) and `stress_label` if present.",
    "",
    "Brevity rules:",
    "- OVERALL: no strict limit, but stay readable.",
    "- sleep/stress/exercise/nutrition/bp/weight: MAX 2 sentences each. No long lists. No day-by-day dumps.",
    "",
    `Profile: ${profileName || profileId} (${profileId})`,
    `As-of dayKey: ${dayKey}`,
    `Time zone: ${timeZone}`,
    "",
    "Daily data (oldest → newest):",
    JSON.stringify(days),
    "",
    "Return ONLY a single JSON object with EXACTLY these keys and shapes:",
    "{",
    '  "overall":  { "title": string, "body": string },',
    '  "sleep":    { "title": string, "body": string },',
    '  "stress":   { "title": string, "body": string },',
    '  "exercise": { "title": string, "body": string },',
    '  "nutrition":{ "title": string, "body": string },',
    '  "bp":       { "title": string, "body": string },',
    '  "weight":   { "title": string, "body": string }',
    "}",
  ].join("\n");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const insightResponse = await client.responses.create({
    model: OPENAI_MODEL,
    input: promptText,
    max_output_tokens: 1000,
  });

  const insightText = typeof insightResponse.output_text === "string" ? insightResponse.output_text : "";
  const insightParsed = extractJsonObject(insightText);
  const insightBlocks = normalizeInsightsText(insightParsed);
  if (!insightBlocks) {
    const err = new Error("Model returned invalid insights JSON.");
    err.raw = insightText.slice(0, 5000);
    throw err;
  }

  return insightBlocks;
}

app.get("/insights", logInsightsRequest, limitInsightsAny, requireInsightsProxyAuth, limitInsightsGet, (req, res) => {
  const jobId = typeof req.query.jobId === "string" ? req.query.jobId.trim() : "";
  if (!jobId) {
    res.status(400).json({ ok: false, error: 'Missing required query param "jobId".' });
    return;
  }

  const job = insightsJobs.get(jobId);
  if (!job) {
    res.status(404).json({ ok: false, error: "Unknown/expired jobId." });
    return;
  }

  if (job.status === "pending") {
    res.status(202).json({ ok: true, jobId, status: "pending" });
    return;
  }

  if (job.status === "error") {
    res.status(500).json({
      ok: false,
      jobId,
      status: "error",
      error: job.error ?? "Failed to generate insights.",
      raw: INSIGHTS_INCLUDE_RAW ? (job.raw ?? null) : null,
    });
    return;
  }

  res.json({
    ok: true,
    jobId,
    status: "done",
    model: OPENAI_MODEL,
    dayKey: job.dayKey,
    analysisVersion: ANALYSIS_VERSION,
    insights: job.insights,
  });
});

app.post("/insights", logInsightsRequest, limitInsightsAny, requireInsightsProxyAuth, limitInsightsPost, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(400).json({
      ok: false,
      error: "Missing OPENAI_API_KEY",
    });
    return;
  }

  const body = req.body;
  if (!isPlainObject(body)) {
    res.status(400).json({ ok: false, error: "Expected a JSON object body." });
    return;
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const profileName = typeof body.profileName === "string" ? body.profileName.trim() : "";
  const dayKey = typeof body.dayKey === "string" ? body.dayKey.trim() : "";
  const timeZone =
    typeof body.timeZone === "string" && body.timeZone.trim() ? body.timeZone.trim() : "America/Los_Angeles";
  const days = Array.isArray(body.days) ? body.days.slice(-14) : [];

  if (!profileId) {
    res.status(400).json({ ok: false, error: 'Missing required field "profileId".' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    res.status(400).json({ ok: false, error: 'Missing/invalid required field "dayKey" (YYYY-MM-DD).' });
    return;
  }
  if (days.length === 0) {
    res.status(400).json({ ok: false, error: 'Missing required field "days" (non-empty array).' });
    return;
  }

  pruneInsightsJobs();
  const jobId = makeJobId();
  insightsJobs.set(jobId, { status: "pending", createdAt: Date.now(), dayKey });

  res.status(202).json({ ok: true, jobId, status: "pending" });

  void (async () => {
    try {
      const insights = await generateInsights({ profileId, profileName, dayKey, timeZone, days });
      insightsJobs.set(jobId, { status: "done", createdAt: Date.now(), dayKey, insights });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const raw = getRawError(err);
      insightsJobs.set(jobId, { status: "error", createdAt: Date.now(), dayKey, error: message, raw });
    }
  })();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${PORT}`);
});
