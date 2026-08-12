// ghl.mjs — carica la newsletter come Email Template su GoHighLevel (LeadConnector API v2).
//
// FILOSOFIA (come nel tuo ghl-probe.mjs): non diamo per scontato cosa il token può fare.
// `probe()` interroga gli endpoint email uno per uno e riporta chi risponde; su quello
// costruiamo il create reale. Il token vive SOLO in .env / ambiente, mai nel codice né in chat.

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

const TOKEN_NAMES = ["GHL_EMAIL_TOKEN", "GHL_WRITE_TOKEN", "GHL_TOKEN", "GHL_PIT", "GHL_PRIVATE_TOKEN", "GOHIGHLEVEL_TOKEN"];

export function readToken(env = process.env) {
  const name = TOKEN_NAMES.find((n) => env[n]);
  if (!name) return { token: null, name: null };
  return { token: env[name], name };
}

function headers(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json", ...extra };
}

async function req(method, path, { token, query = {}, body } = {}) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) if (v != null) u.searchParams.set(k, v);
  const res = await fetch(u, {
    method,
    headers: headers(token, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, json };
}

// Ricognizione: cosa risponde davvero il token sugli endpoint email?
export async function probe({ token, locationId }) {
  const out = [];
  const tries = [
    ["GET  /emails/builder", () => req("GET", "/emails/builder", { token, query: { locationId, limit: 1 } })],
    ["GET  /emails/schedule", () => req("GET", "/emails/schedule", { token, query: { locationId, limit: 1 } })],
    ["GET  /locations/{id}", () => req("GET", `/locations/${locationId}`, { token })],
  ];
  for (const [label, fn] of tries) {
    const r = await fn();
    const msg = r.ok ? "OK" : String(r.json?.message || r.json?.error || "").slice(0, 80);
    out.push({ label, status: r.status, ok: r.ok, msg });
  }
  return out;
}

// Cerca un template già esistente con quel titolo (per non duplicare a ogni run).
async function findTemplateByTitle({ token, locationId, title }) {
  const r = await req("GET", "/emails/builder", { token, query: { locationId, limit: 100 } });
  if (!r.ok) return null;
  const list = r.json?.builders || r.json?.templates || r.json?.data || [];
  const hit = list.find((x) => (x.name || x.title) === title);
  return hit ? (hit.id || hit._id) : null;
}

// Crea (o aggiorna, se esiste già con lo stesso titolo) un Email Template HTML e ci scrive l'HTML.
// Ritorna { templateId, previewUrl, reused } oppure lancia con il corpo dell'errore.
export async function createHtmlEmail({ token, locationId, title, html, updatedBy }) {
  if (!updatedBy) {
    throw new Error("updatedBy mancante: imposta GHL_USER_ID nel .env (il tuo user id GHL). L'endpoint /emails/builder/data lo richiede.");
  }

  // 0) idempotenza: se un template con lo stesso titolo c'è già, lo riuso invece di duplicarlo
  let templateId = await findTemplateByTitle({ token, locationId, title });
  const reused = !!templateId;

  // 1) altrimenti creo lo shell del template di tipo "html"
  if (!templateId) {
    const create = await req("POST", "/emails/builder", {
      token,
      body: { locationId, title, type: "html", updatedBy, builderVersion: "2", isPlainText: false },
    });
    if (!create.ok) {
      throw new Error(`create shell fallito (${create.status}): ${JSON.stringify(create.json)}`);
    }
    templateId = create.json?.redirect?.split("/").pop() || create.json?.templateId || create.json?.id || create.json?._id;
  }

  // 2) scrive l'HTML nel template
  const save = await req("POST", "/emails/builder/data", {
    token,
    body: {
      locationId,
      templateId,
      html,
      editorType: "html",
      updatedBy,
    },
  });
  if (!save.ok) {
    throw new Error(`salvataggio HTML fallito (${save.status}): ${JSON.stringify(save.json)} — templateId=${templateId}`);
  }

  return {
    templateId,
    reused,
    previewUrl: `https://backend.leadconnectorhq.com/emails/schedule/preview/${locationId}/${templateId}`,
  };
}
