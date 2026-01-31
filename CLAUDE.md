# AGENTS.md

This file defines how AI coding agents should collaborate on this repository.  
**Follow these rules exactly.**

---

## Non-negotiable workflow rules

### 1) Always propose a plan before editing code
Before making any code changes, you **must** respond with:
1. A short plan (bullets are fine)
2. The **exact list of files** you intend to edit (paths)

Only after the user agrees (or continues asking you to proceed) should you apply changes.

### 2) Do not create new files without asking first
If you think a new file is needed, you must:
- Ask first
- Explain **why** it’s needed
- Explain **where** it will live (path)
- Explain **what** will be in it

## Coding standards

### General
- Prefer readability and maintainability.
- Avoid “magic constants”; centralize config where patterns already exist.

---

## PR-style output expectations (in chat)

After implementing requested changes, summarize:
- What changed (high-level)
- Which files changed (paths)
- Any follow-ups the user might want (as suggestions, not automatic work)

---

## If anything is unclear

- Ask targeted questions **before** coding.
- Prefer two or three crisp questions over assumptions.
- If forced to assume, state assumptions explicitly and keep changes minimal.