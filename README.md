# Wellness Aggregator (Prototype)

Unifies sleep, nutrition, activity, and vitals into a single daily “health story”, and generates
actionable insights via correlation discovery and anomaly detection.

## What’s included
- **Unified Health Story Dashboard**: aligned daily charts (sleep, sugar, training load, resting HR, weight).
- **Correlation discovery**: top same-day correlations + a few “today → tomorrow” lag correlations.
- **Anomaly detection**: rolling-baseline z-scores + sustained resting-HR elevation streak detection.
- **Local-first**: runs fully in your browser; no backend, no accounts.

## Run the demo
### Option A: open directly (works everywhere)
- Open `index.html` in your browser
- Click **Upload JSON** and select `data/sample-health-data.json`

### Option B: run a local server (enables “Load sample” button)
Use any static file server. For example:
- `python3 -m http.server 5173`
- `npx serve .` (requires Node + npm)

Then open the printed URL and click **Load sample**.

## Data format
The app expects a canonical JSON payload with a `records` array (or a raw array of records).
See:
- `data/sample-health-data.json`
- `docs/DESIGN.md`
- The schema block in `index.html`

## Demo/presentation help
- `docs/DEMO_SCRIPT.md`
