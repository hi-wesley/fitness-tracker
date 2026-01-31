# Design Doc — Wellness Aggregator (Static Prototype)

## Goals
- Unify disparate health data streams (sleep, nutrition, activity, vitals) into a single, daily view.
- Turn raw metrics into actionable insights via:
  - correlation discovery (same-day + simple lag)
  - anomaly detection against a personal baseline
- Keep the prototype easy to demo and easy to run: no accounts, no backend.

## Non-goals (for this prototype)
- Direct integrations with HealthKit / Google Fit / MyFitnessPal APIs.
- User accounts, sync, or cloud storage.
- Clinical-grade or diagnostic recommendations.

## Tech stack
- Plain HTML/CSS/JS (no dependencies)
- Runs fully in-browser; data is analyzed locally.

## Data model (canonical JSON)
The prototype accepts a canonical JSON payload that can represent many “source” systems.

Top-level:
- `schemaVersion`: number (currently `1`)
- `user`: optional object, supports `tz` (IANA time zone)
- `records`: array of records from any sources

Record shapes:
- Point-in-time record:
  - `type`: string (e.g. `nutrition`, `weight`, `resting_heart_rate`, `steps`, `blood_pressure`)
  - `timestamp`: ISO string
  - `data`: object with type-specific fields
  - `source`: string
- Interval record:
  - `type`: string (e.g. `sleep_session`, `workout`)
  - `start`: ISO string
  - `end`: ISO string
  - `data`: object with type-specific fields
  - `source`: string

Supported record `type`s in this prototype:
- `sleep_session`: `data.quality` (optional), duration derived from `start`/`end`
- `nutrition`: `data.calories`, `data.protein_g`, `data.sugar_g`
- `steps`: `data.count`
- `workout`: `data.duration_min` (optional), `data.calories` (optional), `data.intensity` (`easy|moderate|hard`)
- `resting_heart_rate`: `data.bpm`
- `weight`: `data.kg`
- `blood_pressure`: `data.systolic`, `data.diastolic`, `data.unit`

Sample dataset:
- `data/sample-health-data.json`

## Daily unification logic
The app normalizes all records into a daily “rollup” series.

- Time zone:
  - uses `user.tz` if present + valid, otherwise uses the browser’s time zone
- Day assignment:
  - `sleep_session`: assigned to the *wake day* (based on `end`)
  - `workout`: assigned to the *start day* (based on `start`)
  - all other records: assigned by `timestamp`
- Aggregations:
  - sleep: sum durations, average quality
  - nutrition: sum daily totals
  - steps: sum
  - workouts: sum minutes + calories; compute `workout_load = minutes * intensityFactor`
  - weight/blood pressure: use latest reading of the day
  - resting HR: daily average (supports multiple readings)

## Insights engine
### Correlation discovery
- Computes Pearson correlation `r` between metrics over days with overlapping data.
- Shows:
  - top same-day correlations across key metrics
  - a small set of lag correlations (today → tomorrow) for “sleep impact” storytelling

### Anomaly detection
- Rolling baseline over previous `N` days (default 14, minimum 5 points).
- Flags anomalies when `|z| >= threshold` (default 2.0).
- Special-case insight: sustained elevated resting HR streaks (3+ days) using a robust baseline.

### Output
- A narrative “story” timeline (notable streaks/periods)
- An insight feed with severity tags (Insight / Watch / Alert)

## UI/UX
- Import via paste or file upload.
- “Load sample” for demos when served via a local server.
- Unified dashboard as small-multiple charts aligned by day.
- Hover tooltips on charts for quick inspection.

## Future enhancements
- Data ingestion:
  - connectors + ETL adapters for HealthKit/Google Fit/MyFitnessPal exports
  - schema versioning + validation UI
- Better modeling:
  - per-user baselines by weekday and training phase
  - multivariate models (sleep + training + nutrition → HR/HRV/weight)
  - confounder handling + causal caveats
- Productization:
  - accounts + persistence
  - scheduled re-analysis + notifications
  - privacy controls + encryption

