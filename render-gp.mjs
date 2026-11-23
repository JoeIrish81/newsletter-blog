// render-gp.mjs — newsletter del venerdì di Giovanni Perilli, interamente su Render (dal 23/11/2026).
//
// prepara():  articoli degli ultimi 7 giorni → testi (Claude API; se non disponibile, estratti WP) →
//             HTML (template-gp: footer reale, box Telegram/Substack) → aggiorna il template fisso
//             «Newsletter GP — in uscita (usata dal workflow)» + valori personalizzati oggetto/preheader →
//             mail di prova a Claudio → messaggio nel canale Cliq #Newsletter GP con il link «Approva e invia».
// invia():    (dopo il clic di Claudio) mette l'etichetta newsletter-gp-invio a tutti i contatti validi:
//             il workflow GHL «Newsletter GP - invio settimanale (Render)» manda la mail e toglie l'etichetta.
//
// Lo stato persistente sta in GHL (valore personalizzato «Newsletter GP stato»), perché il disco di Render si azzera.

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { fetchArticles } from "./wp.mjs";
import { buildEmail } from "./template-gp.mjs";
import { acapo } from "./acapo.mjs";
import { createHtmlEmail } from "./ghl.mjs";

const API = "https://services.leadconnectorhq.com";
const LOC = process.env.GHL_LOCATION_ID || "65dgBotw4hBLniJ5BTL2";
const TEMPLATE_TITOLO = "Newsletter GP — in uscita (usata dal workflow)";
const TAG = "newsletter-gp-invio";
const CLAUDIO = process.env.CLAUDIO_CONTACT_ID || "zr7pi22IYXEHjd0uKArT";
const CV = { oggetto: "Newsletter GP oggetto", preheader: "Newsletter GP preheader", stato: "Newsletter GP stato" };
const CLIQ_URL = "https://cliq.zoho.eu/company/20080180525/api/v2/channelsbyname/newslettergp/message";
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || "https://newsletter-blog.onrender.com";
const MODEL = process.env.CLAUDE_MODEL_GP || "claude-opus-5-5";
const ESCLUDI = /fotografia/i;

const H = (v = "2021-07-28") => ({ Authorization: `Bearer ${process.env.GHL_EMAIL_TOKEN}`, Version: v, Accept: "application/json", "Content-Type": "application/json" });
async function ghl(method, path, body, v) {
  const r = await fetch(API + path, { method, headers: H(v), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`GHL ${method} ${path} → ${r.status} ${t.slice(0, 200)}`);
  return j;
}
const oggiRoma = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

// ---------- valori personalizzati (anche come «disco» per lo stato) ----------
async function cvLista() { return (await ghl("GET", `/locations/${LOC}/customValues`)).customValues || []; }
async function cvSet(nome, valore) {
  const esiste = (await cvLista()).find((c) => c.name === nome);
  if (esiste) return ghl("PUT", `/locations/${LOC}/customValues/${esiste.id}`, { name: nome, value: valore });
  return ghl("POST", `/locations/${LOC}/customValues`, { name: nome, value: valore });
}
export async function leggiStato() {
  const c = (await cvLista()).find((x) => x.name === CV.stato);
  try { return c ? JSON.parse(c.value) : { inviati: [] }; } catch { return { inviati: [] }; }
}
async function salvaStato(s) { await cvSet(CV.stato, JSON.stringify(s)); }

// ---------- Cliq ----------
export async function cliq(text) {
  if (!process.env.CLIQ_ZAPIKEY || process.env.CLIQ_SOLO_LOG) { console.log("[cliq] (solo log):", text); return; }
  const r = await fetch(`${CLIQ_URL}?zapikey=${encodeURIComponent(process.env.CLIQ_ZAPIKEY)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (r.status >= 300) console.error("[cliq] errore", r.status, (await r.text()).slice(0, 200));
}

// ---------- testi ----------
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    subject: { type: "string" }, preheader: { type: "string" }, intro: { type: "string" },
    articoli: { type: "array", items: { type: "object", additionalProperties: false, properties: { slug: { type: "string" }, blurb: { type: "string" } }, required: ["slug", "blurb"] } },
  },
  required: ["subject", "preheader", "intro", "articoli"],
};
const SYSTEM = `Scrivi la newsletter del venerdì di Giovanni Perilli (consulente di ads e marketing con l'intelligenza artificiale) in italiano, per imprenditori e professionisti.
Regole: tono umano e diretto, frasi brevi; niente frasi da AI; MAI il trattino lungo o medio come pausa; parole vietate: gratis, gratuito, offerta, sconto, urgente, guadagna, 100%, compra, clicca qui; niente «oggi/questa settimana»; non inventare nulla oltre titolo ed estratto.
Oggetto max 55 caratteri, senza emoji, punto esclamativo o parole in maiuscolo. Preheader max 110 caratteri con 3-4 temi. Intro 1-2 frasi che seguono «Ciao Nome,» e iniziano con la minuscola.
Scegli i 4 articoli più utili per chi fa o delega ads, marketing e AI, con temi vari. Blurb 2-3 frasi (max 300 caratteri), testo semplice.`;

// taglia a fine parola e non lascia preposizioni/articoli in coda (regola a capo giornalistico)
const CORTE_FINE = /\s+(il|lo|la|i|gli|le|un|una|di|a|da|in|con|su|per|tra|fra|e|o|ma|che|del|della|dei|delle|al|alla|nel|nella)$/i;
function tagliaParole(t, max) {
  let x = String(t).trim();
  if (x.length > max) x = x.slice(0, max).replace(/\s+\S*$/, "");
  while (CORTE_FINE.test(x)) x = x.replace(CORTE_FINE, "");
  return x.replace(/[,;:]$/, "");
}
const pulisci = (s) => String(s || "").replace(/\s*[—–]\s*/g, ", ").replace(/!{2,}/g, "!").trim();

async function testiConClaude(candidati) {
  const client = new Anthropic();
  const lista = candidati.map((a, i) => `${i + 1}. [${a.slug}] ${a.title}\n   categorie: ${a.categories.join(", ")}\n   estratto: ${a.blurb}`).join("\n");
  const res = await client.messages.create({
    model: MODEL, max_tokens: 3000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Articoli degli ultimi 7 giorni:\n\n${lista}\n\nScegli e scrivi.` }],
  });
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

// Ripiego senza AI (es. chiave Anthropic al limite): 4 articoli più recenti, preferendo ads/AI, estratti WP.
function testiDiRipiego(candidati) {
  const pref = (a) => (a.categories.some((c) => /ads|strategy|info|tips/i.test(c)) ? 0 : 1);
  const scelti = [...candidati].sort((a, b) => pref(a) - pref(b) || (a.dateISO < b.dateISO ? 1 : -1)).slice(0, 4);
  return {
    subject: tagliaParole(pulisci(scelti[0].title.split(":")[0]), 55),
    preheader: tagliaParole("Più " + scelti.slice(1).map((a) => pulisci(a.title.split(":")[0])).join(", "), 110),
    intro: "ecco gli articoli che secondo me valgono il tuo tempo, scelti tra quelli usciti sul blog.",
    articoli: scelti.map((a) => ({ slug: a.slug, blurb: a.blurb })),
    ripiego: true,
  };
}

// ---------- PREPARA ----------
export async function prepara({ forza = false } = {}) {
  const data = oggiRoma();
  const stato = await leggiStato();
  if (!forza && stato.data === data && ["in-attesa-ok", "inviata", "invio-in-corso"].includes(stato.stato)) {
    return { saltato: true, motivo: `edizione ${data} già ${stato.stato}` };
  }

  const fine = new Date(), inizio = new Date(); inizio.setDate(inizio.getDate() - 7);
  const tutti = await fetchArticles({ afterISO: inizio.toISOString().slice(0, 19), beforeISO: fine.toISOString().slice(0, 19), max: 40 });
  const inviati = new Set(stato.inviati || []);
  const candidati = tutti.filter((a) => a.imageUrl && !inviati.has(a.slug) && !a.categories.some((c) => ESCLUDI.test(c)));
  if (!candidati.length) {
    await cliq("Ciao Claudio, questa settimana non ci sono articoli nuovi sul blog, quindi la newsletter salta. Charlie, l'assistente di Giò");
    return { saltato: true, motivo: "nessun articolo nuovo" };
  }

  let copy;
  try { copy = await testiConClaude(candidati); }
  catch (e) { console.error("Claude non disponibile, uso il ripiego:", e.message); copy = testiDiRipiego(candidati); }
  const bySlug = Object.fromEntries(candidati.map((a) => [a.slug, a]));
  let scelti = (copy.articoli || []).filter((x) => bySlug[x.slug]).slice(0, 4);
  if (!scelti.length) { copy = testiDiRipiego(candidati); scelti = copy.articoli; }

  const ed = {
    campaign: `nl-${data}`,
    subject: pulisci(copy.subject), preheader: pulisci(copy.preheader),
    eyebrow: "La newsletter di Giovanni Perilli",
    introHtml: `<p style="margin:0;">${acapo(pulisci(copy.intro))}</p>`,
    box: { titolo: "Due modi per restare aggiornato", testo: "Sul canale Telegram trovi le novità su ads e AI appena escono. Su Substack scrivo note più brevi e personali su come lavoro con le campagne e con l’AI." },
    sectionTitle: "Gli articoli da leggere",
    articles: scelti.map((x) => { const a = bySlug[x.slug]; return { url: a.url, imageUrl: a.imageUrl, imageAlt: a.imageAlt, title: a.title, blurb: pulisci(x.blurb) }; }),
    closingHtml: `<p style="margin:0 0 14px 0;">${acapo("Se hai una domanda su uno di questi temi, rispondi a questa email: la leggo io. E se il canale ti sembra utile, giralo a un collega che lavora con le ads.")}</p><p style="margin:0;">A presto,<br><strong>Giovanni Perilli</strong></p>`,
  };
  const html = buildEmail(ed);

  const t = await createHtmlEmail({ token: process.env.GHL_EMAIL_TOKEN, locationId: LOC, title: TEMPLATE_TITOLO, html, updatedBy: process.env.GHL_USER_ID });
  await cvSet(CV.oggetto, ed.subject);
  await cvSet(CV.preheader, ed.preheader);

  let prova = "non inviata";
  try {
    await ghl("POST", "/conversations/messages", { type: "Email", contactId: CLAUDIO, subject: "[PROVA] " + ed.subject, html, emailFrom: "Giovanni Perilli <info@funnelhacking.it>" }, "2021-04-15");
    prova = "inviata";
  } catch (e) { prova = "errore: " + e.message; }

  const chiave = crypto.randomBytes(12).toString("hex");
  const nuovo = { ...stato, data, stato: "in-attesa-ok", chiave, subject: ed.subject, preheader: ed.preheader, slugs: scelti.map((x) => x.slug), titoli: ed.articles.map((a) => a.title), templateId: t.templateId, previewUrl: t.previewUrl, ripiego: !!copy.ripiego, preparataIl: new Date().toISOString() };
  await salvaStato(nuovo);

  await cliq([
    "Ciao Claudio, template email pronto ✅ È la newsletter di questa settimana.",
    `Oggetto: ${ed.subject}`,
    `Articoli: ${ed.articles.map((a) => a.title).join(" · ")}`,
    `Anteprima: ${t.previewUrl}`,
    prova === "inviata" ? `Ti ho mandato anche la prova nella tua casella (oggetto «[PROVA] ${ed.subject}»).` : "(La mail di prova non è partita: guarda l'anteprima qui sopra.)",
    "Controlla pulsanti e link (Telegram, Substack, articoli, social, consenso e disiscrizione).",
    `Se è tutto ok, apri questo link e premi «Conferma invio»: ${BASE_URL}/approva?k=${chiave}`,
    "Se vuoi cambiare qualcosa scrivilo qui: lo vede Giò.",
    copy.ripiego ? "(Questa settimana i testi sono gli estratti del blog: l'AI non era disponibile.)" : "",
    "Charlie, l'assistente di Giò",
  ].filter(Boolean).join("\n"));

  return { ok: true, data, subject: ed.subject, articoli: nuovo.titoli, prova, previewUrl: t.previewUrl, ripiego: nuovo.ripiego };
}

// ---------- INVIA ----------
async function contattiValidi() {
  // PROVA: TEST_SOLO_CONTATTI=id1,id2 limita l'invio a questi contatti (mai la lista intera)
  if (process.env.TEST_SOLO_CONTATTI) return process.env.TEST_SOLO_CONTATTI.split(",").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (let page = 1; page <= 100; page++) {
    const j = await ghl("POST", "/contacts/search", { locationId: LOC, pageLimit: 500, page });
    const c = j.contacts || [];
    for (const x of c) {
      const tags = (x.tags || []).map((t) => String(t).toLowerCase());
      const dndEmail = x.dndSettings?.Email?.status === "active";
      // «mai_aperto» = mai aperta un'email (pulizia del 23/11/2026, voluta da Giò): esclusi dalla newsletter
      if (x.email && x.validEmail !== false && !x.dnd && !dndEmail && !tags.includes("bounced") && !tags.includes("mai_aperto")) out.push(x.id);
    }
    if (c.length < 500) break;
  }
  return out;
}

const chiaviUsate = new Set(); // seconda protezione dal doppio invio (GHL rilegge con ritardo)
export async function invia(chiave) {
  if (chiaviUsate.has(chiave)) return { ok: false, motivo: "già usato" };
  const stato = await leggiStato();
  if (!stato.chiave || chiave !== stato.chiave) return { ok: false, motivo: "link non valido o scaduto" };
  if (stato.stato === "inviata" || stato.stato === "invio-in-corso") return { ok: false, motivo: `già ${stato.stato} (${stato.data})` };
  if (stato.stato !== "in-attesa-ok") return { ok: false, motivo: `stato ${stato.stato}` };

  chiaviUsate.add(chiave);
  await salvaStato({ ...stato, stato: "invio-in-corso", approvataIl: new Date().toISOString() });
  // per sicurezza riscrive oggetto/preheader dell'edizione approvata
  await cvSet(CV.oggetto, stato.subject);
  await cvSet(CV.preheader, stato.preheader);

  const ids = await contattiValidi();
  let fatti = 0, errori = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const blocco = ids.slice(i, i + 100);
    try { await ghl("POST", "/contacts/bulk/tags/update/add", { locationId: LOC, contacts: blocco, tags: [TAG] }); fatti += blocco.length; }
    catch (e) {
      console.error("bulk tag:", e.message);
      for (const id of blocco) { try { await ghl("POST", `/contacts/${id}/tags`, { tags: [TAG] }); fatti++; } catch { errori++; } }
    }
  }
  const inviati = [...new Set([...(stato.inviati || []), ...(stato.slugs || [])])].slice(-200);
  await salvaStato({ ...stato, stato: "inviata", inviataIl: new Date().toISOString(), contatti: fatti, errori, inviati, chiave: null });
  await cliq(`Grazie Claudio! Newsletter partita ✅ a ${fatti} contatti${errori ? ` (${errori} non riusciti)` : ""}. Charlie, l'assistente di Giò`);
  return { ok: true, contatti: fatti, errori };
}
