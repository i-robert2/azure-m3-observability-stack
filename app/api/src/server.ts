import "./tracing"; // OpenTelemetry — MUST be the very first import
import express from "express";
import { Pool } from "pg";
import { validateTitle } from "./notes";

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.PG_HOST,
  port: 5432,
  database: process.env.PG_DATABASE ?? "appdb",
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false }, // PG Flexible Server requires TLS
  connectionTimeoutMillis: 4000, // fail fast on DB outage (-> 500) instead of hanging
  query_timeout: 4000,
});

async function init(): Promise<void> {
  // Best-effort schema setup; don't crash the pod if the DB is briefly unavailable.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      return;
    } catch (err) {
      console.error(`init attempt ${attempt} failed`, err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error("init: giving up after retries; serving (DB queries will 500 until DB is back)");
}

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/notes", async (_req, res) => {
  try {
    const r = await pool.query("SELECT id, title FROM notes ORDER BY id");
    res.json(r.rows);
  } catch (err) {
    console.error("GET /api/notes failed", err);
    res.status(500).json({ error: "internal error" });
  }
});

app.post("/api/notes", async (req, res) => {
  const { title } = req.body ?? {};
  let clean: string;
  try {
    clean = validateTitle(title);
  } catch {
    res.status(400).json({ error: "title required" });
    return;
  }
  try {
    const r = await pool.query(
      "INSERT INTO notes (title) VALUES ($1) RETURNING id, title",
      [clean],
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("POST /api/notes failed", err);
    res.status(500).json({ error: "internal error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
init().finally(() => app.listen(port, () => console.log(`api on ${port}`)));
