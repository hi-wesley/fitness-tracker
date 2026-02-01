import "dotenv/config";
import cors from "cors";
import express from "express";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-5.2").trim();
const corsOriginRaw = (process.env.CORS_ORIGIN || "*").trim();
const corsOrigin =
  corsOriginRaw === "*"
    ? "*"
    : corsOriginRaw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: OPENAI_MODEL,
    },
  });
});

app.post("/insights", (req, res) => {
  res.status(501).json({
    ok: false,
    error: "Not implemented yet",
    hint: `This endpoint will generate insights with ${OPENAI_MODEL}.`,
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
