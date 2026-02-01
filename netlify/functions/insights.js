const BACKEND_ORIGIN = (process.env.MHP_BACKEND_ORIGIN || "http://5.78.180.72:8787").replace(/\/+$/, "");
const PROXY_SECRET = (process.env.MHP_PROXY_SECRET || process.env.INSIGHTS_PROXY_SECRET || "").trim();

function pickHeader(headers, key) {
  if (!headers) return "";
  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === lowerKey) return String(v || "");
  }
  return "";
}

function filterForwardHeaders(headers) {
  const out = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k).toLowerCase();
    if (key === "host") continue;
    if (key === "connection") continue;
    if (key === "content-length") continue;
    out[key] = String(v ?? "");
  }
  return out;
}

exports.handler = async (event) => {
  const method = event.httpMethod || "GET";

  // Same-origin in practice, but handle preflight cleanly.
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      },
      body: "",
    };
  }

  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const url = `${BACKEND_ORIGIN}/insights${query}`;

  const headers = filterForwardHeaders(event.headers);
  headers.accept = headers.accept || "application/json";
  if (PROXY_SECRET) headers["x-mhp-proxy-secret"] = PROXY_SECRET;

  const clientIp =
    pickHeader(event.headers, "x-nf-client-connection-ip") ||
    pickHeader(event.headers, "x-forwarded-for") ||
    "";
  if (clientIp) headers["x-forwarded-for"] = clientIp;

  const body =
    method === "POST" || method === "PUT" || method === "PATCH"
      ? event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64")
        : event.body || ""
      : undefined;

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") || "application/json";
  const text = await res.text();

  return {
    statusCode: res.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
    body: text,
  };
};

