# Demo Script (5–7 minutes)

## 0:00 — Problem
- “Most people have health data split across wearables, nutrition logs, smart scales, and at-home devices.”
- “That fragmentation makes it hard to answer practical questions like: *How does sleep affect cravings?* or *When should I deload training?*”

## 0:45 — Solution overview
- “This prototype is a single-page app that ingests canonical health JSON and produces a unified daily story.”
- “It runs fully in the browser: no account setup, and your data never leaves the device.”

## 1:15 — Load data
Option A (fastest on demo machine):
- Click **Load sample**

Option B (works even if opened via `file://`):
- Click **Upload JSON**
- Select `data/sample-health-data.json`

## 1:45 — Unified dashboard story
- Point to the aligned charts:
  - Sleep → Sugar → Training Load → Resting HR → Weight
- “This alignment makes it easy to see patterns and spillover effects across days.”
- Hover a few days to show tooltips and the “story” timeline.

## 3:00 — Insights
- Highlight the top insight:
  - short sleep correlating with higher sugar intake
- Highlight anomaly insight:
  - sustained elevated resting heart rate for multiple days, with context
- Emphasize the intent:
  - “These are prompts for reflection and action, not medical diagnoses.”

## 4:30 — Correlation discovery
- Scroll to **Correlation discovery**
- “We compute the strongest same-day correlations automatically.”
- Show lag correlations (today → tomorrow) to reinforce the “sleep impacts next day” narrative.

## 5:30 — Tech + future enhancements
- “This version is pure static: import JSON, aggregate daily, compute correlations and anomaly flags.”
- “Next steps are connectors (HealthKit/Google Fit/MyFitnessPal), persistence, and stronger modeling.”

## 6:30 — Wrap
- “The goal is a holistic view that turns raw numbers into actionable insights, personalized to each user’s baseline.”

