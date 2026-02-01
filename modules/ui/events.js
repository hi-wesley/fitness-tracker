import { FOCUS_RANGE_OPTIONS } from "./state.js";

export function wireEvents({
  onRangeChange,
  onProfileSelect,
} = {}) {
  document.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button[data-range-panel][data-range-days]");
    if (!btn) return;
    const panel = btn.dataset.rangePanel;
    const days = Number(btn.dataset.rangeDays);
    if (!panel || !Number.isFinite(days)) return;
    const allowed = FOCUS_RANGE_OPTIONS[panel];
    if (!Array.isArray(allowed) || !allowed.includes(days)) return;
    if (typeof onRangeChange === "function") onRangeChange({ panel, days });
  });

  document.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button[data-profile]");
    if (!btn) return;
    const profileId = btn.dataset.profile;
    if (!profileId) return;
    if (typeof onProfileSelect === "function") onProfileSelect({ profileId });
  });
}

