function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export async function fetchInsightsJob({ payload, signal, timeoutMs = 90_000 } = {}) {
  const startRes = await fetch("/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload ?? {}),
  });

  const startData = await startRes.json().catch(() => null);
  if (!startRes.ok) {
    const message =
      isPlainObject(startData) && typeof startData.error === "string"
        ? startData.error
        : `Request failed (${startRes.status})`;
    throw new Error(message);
  }

  const jobId = isPlainObject(startData) && typeof startData.jobId === "string" ? startData.jobId.trim() : "";
  if (!jobId) throw new Error("Backend did not return a jobId");

  const deadlineMs = Date.now() + timeoutMs;
  let delayMs = 650;

  while (Date.now() < deadlineMs) {
    const pollRes = await fetch(`/insights?jobId=${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    const pollData = await pollRes.json().catch(() => null);

    if (pollRes.status === 202) {
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(2400, Math.round(delayMs * 1.35));
      continue;
    }

    if (!pollRes.ok) {
      const message =
        isPlainObject(pollData) && typeof pollData.error === "string"
          ? pollData.error
          : `Request failed (${pollRes.status})`;
      throw new Error(message);
    }

    return pollData;
  }

  throw new Error("Timed out waiting for AI insights.");
}

