// server.mjs — web service sempre-acceso per Render (piano free).
// Tiene vivo il processo con un self-ping e lancia il job del venerdì mattina
// tramite uno scheduler interno (node-cron). Il job è `node newsletter.mjs --auto`:
// aggiorna il template in GHL, NON invia (Giovanni duplica la campagna e invia a mano).

import express from "express";
import cron from "node-cron";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3200;

let lastRun = null;   // { at, ok, output }

// Esegue la pipeline (--auto) come processo figlio e cattura l'esito.
function runAuto() {
  return new Promise((resolve) => {
    console.log(`[${new Date().toISOString()}] Avvio job newsletter --auto`);
    exec("node newsletter.mjs --auto", { cwd: ROOT, timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
      const output = (stdout || "") + (stderr || "");
      lastRun = { at: new Date().toISOString(), ok: !err, output: output.slice(-4000) };
      console.log(output);
      if (err) console.error("Job fallito:", err.message);
      resolve(lastRun);
    });
  });
}

// --- endpoint ---
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/", (_req, res) => {
  res.type("html").send(`<h3>Newsletter blog → GHL</h3>
    <p>Scheduler attivo: venerdì 07:00 (Europe/Rome).</p>
    <p>Ultimo run: ${lastRun ? `${lastRun.at} — ${lastRun.ok ? "OK" : "ERRORE"}` : "mai"}</p>
    <pre style="white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:8px;">${(lastRun?.output || "").replace(/</g, "&lt;")}</pre>`);
});

// Trigger manuale protetto: /run?token=RUN_TOKEN  (per test/forzature)
app.get("/run", async (req, res) => {
  if (!process.env.RUN_TOKEN || req.query.token !== process.env.RUN_TOKEN) {
    return res.status(403).send("forbidden");
  }
  res.status(202).send("job avviato, controlla / tra qualche minuto");
  runAuto();
});

// --- scheduler: venerdì mattina, ora italiana ---
cron.schedule("0 7 * * 5", () => runAuto(), { timezone: "Europe/Rome" });

// --- self-ping: evita lo spin-down del piano free (Render dorme dopo ~15 min di idle) ---
const SELF = process.env.RENDER_EXTERNAL_URL;
if (SELF) {
  setInterval(() => {
    fetch(`${SELF}/healthz`).catch(() => {});
  }, 14 * 60 * 1000); // ogni 14 minuti
}

app.listen(PORT, () => console.log(`Server in ascolto su :${PORT} — scheduler venerdì 07:00 Europe/Rome`));
