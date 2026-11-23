// server.mjs — web service sempre acceso su Render (piano free).
// Dal 23/11/2026 fa TUTTA la newsletter del venerdì di Giovanni Perilli (vedi render-gp.mjs):
//   venerdì 11:00 Europe/Rome → prepara(): bozza nel template GHL + prova a Claudio + messaggio Cliq #Newsletter GP
//   Claudio apre /approva?k=… e preme «Conferma invio» → invia(): etichetta a tutti i contatti → workflow GHL invia.
// Se la lettura del blog fallisce (firewall SiteGround) riprova alle 11:30, 12:00, 13:00 e poi avvisa su Cliq.
// Il vecchio job «La settimana in digital» (newsletter.mjs --auto) resta solo come comando manuale.

import express from "express";
import cron from "node-cron";
import { prepara, invia, leggiStato, cliq } from "./render-gp.mjs";

const app = express();
app.use(express.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3200;

let ultimo = null; // { at, esito }
const log = (esito) => { ultimo = { at: new Date().toISOString(), esito }; console.log(JSON.stringify(ultimo)); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pagina = (titolo, corpo) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titolo)}</title></head>
<body style="font-family:Arial,sans-serif;background:#eef0f4;margin:0;padding:24px;color:#1a1a1a;"><div style="max-width:560px;margin:auto;background:#fff;border-radius:10px;padding:24px;">${corpo}</div></body></html>`;

// --- preparazione con nuovi tentativi ---
let tentativo = 0;
async function preparaConRiprova() {
  try {
    const r = await prepara();
    log({ prepara: r });
    tentativo = 0;
  } catch (e) {
    log({ prepara: "errore", messaggio: e.message });
    const attese = [30, 30, 60]; // minuti: 11:30, 12:00, 13:00
    if (tentativo < attese.length) {
      const min = attese[tentativo++];
      setTimeout(preparaConRiprova, min * 60 * 1000);
    } else {
      tentativo = 0;
      await cliq(`Ciao Claudio, oggi non riesco a preparare la newsletter: ${e.message.slice(0, 200)}. Giò, ci guardiamo? Charlie, l'assistente di Giò`);
    }
  }
}

// --- endpoint ---
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/", async (_req, res) => {
  let s = {};
  try { s = await leggiStato(); } catch (e) { s = { errore: e.message }; }
  const pub = { data: s.data, stato: s.stato, subject: s.subject, articoli: s.titoli, contatti: s.contatti, inviataIl: s.inviataIl, ripiego: s.ripiego };
  res.type("html").send(pagina("Newsletter GP", `<h3>Newsletter GP (Render)</h3>
    <p>Preparazione automatica: venerdì 11:00 ora italiana. Invio: dopo «Conferma invio» di Claudio.</p>
    <pre style="white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:8px;">${esc(JSON.stringify(pub, null, 2))}</pre>
    <p>Ultima operazione: ${esc(ultimo?.at || "nessuna dall'avvio")}</p>`));
});

// Pagina di conferma: il GET non invia nulla (le anteprime dei link in Cliq lo aprono da sole).
app.get("/approva", async (req, res) => {
  const s = await leggiStato().catch(() => ({}));
  if (!req.query.k || req.query.k !== s.chiave) return res.status(403).type("html").send(pagina("Link non valido", "<p>Link non valido o già usato.</p>"));
  if (s.stato !== "in-attesa-ok") return res.type("html").send(pagina("Già fatto", `<p>Questa newsletter è già: <b>${esc(s.stato)}</b>.</p>`));
  res.type("html").send(pagina("Conferma invio", `<h3>Newsletter del ${esc(s.data)}</h3>
    <p><b>Oggetto:</b> ${esc(s.subject)}</p><p><b>Anteprima:</b> ${esc(s.preheader)}</p>
    <ul>${(s.titoli || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p><a href="${esc(s.previewUrl)}" target="_blank">Apri l'anteprima della mail</a></p>
    <form method="post" action="/approva"><input type="hidden" name="k" value="${esc(req.query.k)}">
    <button style="background:#ed4b16;color:#fff;border:0;border-radius:8px;padding:14px 26px;font-size:16px;font-weight:bold;cursor:pointer;">Conferma invio a tutta la lista</button></form>
    <p style="color:#6b6b6b;font-size:13px;">L'invio parte solo con questo pulsante e una sola volta.</p>`));
});

let inviando = false; // blocco anti doppio clic (GHL a volte rilegge lo stato con qualche secondo di ritardo)
app.post("/approva", async (req, res) => {
  if (inviando) return res.status(409).type("html").send(pagina("In corso", "<p>Invio già in corso.</p>"));
  inviando = true;
  try {
    const r = await invia(req.body.k);
    log({ invia: r });
    if (!r.ok) return res.status(409).type("html").send(pagina("Non inviato", `<p>Non inviato: ${esc(r.motivo)}.</p>`));
    res.type("html").send(pagina("Partita", `<h3>Partita ✅</h3><p>Etichetta messa a ${r.contatti} contatti: GHL sta inviando la newsletter.</p>`));
  } catch (e) {
    log({ invia: "errore", messaggio: e.message });
    await cliq(`Attenzione: l'invio della newsletter si è fermato con un errore (${e.message.slice(0, 150)}). Giò, ci guardiamo? Charlie`);
    res.status(500).type("html").send(pagina("Errore", `<p>Errore: ${esc(e.message)}</p>`));
  } finally { inviando = false; }
});

// Trigger manuale protetto: /prepara?token=RUN_TOKEN[&forza=1]
app.get("/prepara", async (req, res) => {
  if (!process.env.RUN_TOKEN || req.query.token !== process.env.RUN_TOKEN) return res.status(403).send("forbidden");
  try { const r = await prepara({ forza: req.query.forza === "1" }); log({ prepara: r }); res.json(r); }
  catch (e) { log({ prepara: "errore", messaggio: e.message }); res.status(500).json({ errore: e.message }); }
});

// --- scheduler: venerdì 11:00 ora italiana ---
// Interruttore: il giro automatico parte solo con NEWSLETTER_ATTIVA=1 (evita doppioni con le attività del PC)
if (process.env.NEWSLETTER_ATTIVA === "1") cron.schedule("0 11 * * 5", () => preparaConRiprova(), { timezone: "Europe/Rome" });
else console.log("Giro del venerdì SPENTO (NEWSLETTER_ATTIVA != 1): resta solo /prepara manuale");

// --- self-ping: evita lo spin-down del piano free ---
const SELF = process.env.RENDER_EXTERNAL_URL;
if (SELF) setInterval(() => { fetch(`${SELF}/healthz`).catch(() => {}); }, 14 * 60 * 1000);

app.listen(PORT, () => console.log(`Newsletter GP in ascolto su :${PORT} — venerdì 11:00 Europe/Rome`));
