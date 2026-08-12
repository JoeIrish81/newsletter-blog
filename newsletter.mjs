// newsletter.mjs — automazione newsletter settimanale dal blog di giovanniperilli.com.
//
// Flusso:
//   1) legge gli articoli usciti nella finestra scelta (default: ultimi 7 giorni) dal blog WP;
//   2) costruisce l'email HTML col template "La settimana in digital" (identico a GHL);
//   3) salva build/<label>.html + build/<label>.content.json (copy modificabile a mano);
//   4) con --push, carica il template su GoHighLevel via API.
//
// Uso:
//   node newsletter.mjs                      # ultimi 7 giorni fino a oggi
//   node newsletter.mjs --days 7 --before 2026-08-16
//   node newsletter.mjs --content build/2026-08-16.content.json   # rigenera da copy rifinita
//   node newsletter.mjs --content build/....json --push           # crea il template su GHL

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchArticles } from "./wp.mjs";
import { buildEmailTable, wrapPreview, DEFAULTS, numeroInLettere } from "./template.mjs";
import { readToken, createHtmlEmail, probe } from "./ghl.mjs";
import { generateCopy } from "./copy.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// carica .env (semplice, senza dipendenze)
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

// --- args ---
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith("--") || i + 1 >= args.length ? true : args[i + 1]) : def;
};
const has = (name) => args.includes(`--${name}`);

const days = parseInt(flag("days", "7"), 10);
const beforeArg = flag("before", null);          // YYYY-MM-DD (fine finestra, inclusa)
const contentFile = flag("content", null);       // riusa una copy già rifinita
const doAuto = has("auto");                       // fetch → copy Claude → build → push, tutto in uno
const doPush = has("push") || doAuto;
const doProbe = has("probe");
const LOCATION_ID = flag("location", process.env.GHL_LOCATION_ID || "65dgBotw4hBLniJ5BTL2");

function isoRange() {
  const end = beforeArg ? new Date(beforeArg + "T23:59:59") : new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 19);
  return { afterISO: fmt(start), beforeISO: fmt(end), label: (beforeArg || end.toISOString().slice(0, 10)) };
}

// L'apertura è FISSA e senza riferimenti temporali (la mail viene rinviata anche nei giorni dopo).
const INTRO_P1 = "Come sempre, ti faccio il punto della settimana.";

function buildContent(articles, copy) {
  const n = articles.length;
  const introP2 = copy?.introTopics
    || `Settimana ricca. ${numeroInLettere(n)} articoli, te li ho messi in fila dal più recente.`;
  return {
    ...DEFAULTS,
    introHtml: `<p style="margin:0 0 14px 0;">${INTRO_P1}</p>
            <p style="margin:0;">${introP2}</p>`,
    articles: articles.map((a) => ({
      url: a.url, imageUrl: a.imageUrl, imageAlt: a.imageAlt,
      date: a.date, title: a.title,
      blurb: (copy?.blurbs && copy.blurbs[a.slug]) || a.blurb,   // copy Claude, altrimenti estratto WP
    })),
  };
}

async function main() {
  let content, label;

  if (contentFile) {
    content = JSON.parse(fs.readFileSync(contentFile, "utf8"));
    label = path.basename(contentFile).replace(/\.content\.json$/, "");
    console.log(`Copy caricata da ${contentFile} (${content.articles.length} articoli).`);
  } else {
    const { afterISO, beforeISO, label: lbl } = isoRange();
    label = lbl;
    console.log(`Leggo il blog: ${afterISO} → ${beforeISO} (ultimi ${days} giorni)`);
    const articles = await fetchArticles({ afterISO, beforeISO });
    if (!articles.length) { console.error("Nessun articolo nella finestra. Controlla le date."); process.exit(1); }
    articles.forEach((a) => console.log(`  • ${a.dateISO}  ${a.title}`));

    let copy = null;
    if (doAuto) {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error("\n--auto richiede ANTHROPIC_API_KEY nel .env (per generare la copy con Claude).");
        process.exit(2);
      }
      console.log("\nGenero intro + blurb con Claude…");
      try { copy = await generateCopy(articles); console.log("Copy generata."); }
      catch (e) { console.error("Copy Claude fallita, uso gli estratti WP:", e.message); }
    }

    content = buildContent(articles, copy);
    const cPath = path.join(ROOT, "build", `${label}.content.json`);
    fs.writeFileSync(cPath, JSON.stringify(content, null, 2));
    if (!doAuto) {
      console.log(`\nCopy modificabile salvata in ${cPath}`);
      console.log("  → rifinisci intro/blurb lì, poi rilancia con --content <file> per l'HTML definitivo.");
    }
  }

  const table = buildEmailTable(content);
  const htmlPath = path.join(ROOT, "build", `${label}.html`);
  fs.writeFileSync(htmlPath, wrapPreview(table, `Newsletter ${label}`));
  const tablePath = path.join(ROOT, "build", `${label}.table.html`);
  fs.writeFileSync(tablePath, table);   // il blocco puro da incollare in GHL
  console.log(`\nHTML anteprima: ${htmlPath}`);
  console.log(`Blocco per GHL (custom code): ${tablePath}`);

  const { token, name } = readToken();

  if (doProbe) {
    if (!token) { console.error("\n--probe richiede un token GHL in .env."); process.exit(2); }
    console.log(`\n=== Probe GHL (token da ${name}) ===`);
    for (const r of await probe({ token, locationId: LOCATION_ID })) {
      console.log(`  ${r.label.padEnd(24)} ${r.ok ? "OK" : r.status}  ${r.msg}`);
    }
  }

  if (doPush) {
    if (!token) {
      console.error("\n--push richiede un token GHL con permesso di scrittura email. Aggiungilo in .env (es. GHL_EMAIL_TOKEN=...).");
      process.exit(2);
    }
    console.log(`\nCreo il template su GHL (location ${LOCATION_ID}, token da ${name})…`);
    const r = await createHtmlEmail({
      token,
      locationId: LOCATION_ID,
      title: `La settimana in digital — ${label}`,
      html: table,
      updatedBy: process.env.GHL_USER_ID,
    });
    console.log(`${r.reused ? "Aggiornato (template esistente)" : "Creato"}. templateId=${r.templateId}`);
    console.log(`Anteprima: ${r.previewUrl}`);
    console.log("→ In GHL: Marketing → Emails → Templates. Da lì crei la campagna, scegli la lista e invii.");
  }
}

main().catch((e) => { console.error("\nERRORE:", e.message); process.exit(1); });
