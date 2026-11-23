// newsletter-gp.mjs — newsletter del venerdì di Giovanni Perilli (Funnel Hacking GP), dal 23/11/2026.
//
// node newsletter-gp.mjs --auto            → articoli degli ultimi 7 giorni → scelta e testi con Claude →
//                                            HTML (template-gp, footer reale) → template GHL → prova a Claudio
// node newsletter-gp.mjs --auto --no-test  → come sopra ma senza mail di prova
// node newsletter-gp.mjs --auto --dry      → solo HTML locale, niente GHL né mail
// node newsletter-gp.mjs --list            → solo elenco articoli candidati (build/<data>-gp.candidati.json)
// node newsletter-gp.mjs --content f.json  → usa testi già scritti (li scrive l'attività programmata:
//                                            niente chiave API Anthropic necessaria)
//
// Scrive build/<data>-gp.html e build/<data>-gp.json (stato: oggetto, anteprima, templateId, link, ecc.).
// L'invio a tutta la lista NON lo fa lo script: lo fa l'attività del venerdì da Chrome come campagna GHL,
// solo dopo l'«ok» di Claudio su Cliq.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { fetchArticles } from "./wp.mjs";
import { buildEmail } from "./template-gp.mjs";
import { acapo } from "./acapo.mjs";
import { createHtmlEmail } from "./ghl.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const LOC = process.env.GHL_LOCATION_ID || "65dgBotw4hBLniJ5BTL2";
const CLAUDIO = "zr7pi22IYXEHjd0uKArT"; // contatto GHL di Claudio
const MODEL = process.env.CLAUDE_MODEL_GP || "claude-opus-5-5";
const ESCLUDI_CATEGORIE = /fotografia/i; // il canale e la newsletter sono su ads e AI

const oggi = new Date();
const label = oggi.toISOString().slice(0, 10);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    intro: { type: "string", description: "1-2 frasi dopo «Ciao {{contact.first_name}},», minuscola iniziale, testo semplice" },
    articoli: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { slug: { type: "string" }, blurb: { type: "string" } },
        required: ["slug", "blurb"],
      },
    },
  },
  required: ["subject", "preheader", "intro", "articoli"],
};

const SYSTEM = `Scrivi la newsletter del venerdì di Giovanni Perilli (consulente di ads e marketing con l'intelligenza artificiale) in italiano, alla sua lista di imprenditori e professionisti.
Regole fisse:
- Tono umano e diretto, frasi brevi, come parla una persona. Niente frasi da AI («in un mondo sempre più…», «scopri», «immergiti», «non solo… ma anche»), niente punti esclamativi a raffica, niente maiuscole urlate.
- MAI il trattino lungo (—) né il trattino medio (–) usati come pausa: usa punto, virgola o due punti.
- Parole vietate perché fanno finire in spam: gratis, gratuito, offerta, sconto, urgente, guadagna, 100%, clicca qui, compra.
- Non inventare fatti: usa solo titolo ed estratto. Niente date relative («oggi», «questa settimana»): la mail può essere letta giorni dopo.
- Oggetto: max 55 caratteri, niente emoji, niente punto esclamativo, nessuna parola tutta maiuscola; deve incuriosire sul tema più forte.
- Preheader: max 110 caratteri, completa l'oggetto citando 3-4 temi.
- Scegli i 4 articoli più utili per chi fa o delega ads, marketing e AI (se ce ne sono meno, tutti). Preferisci varietà di temi.
- Per ogni articolo un blurb di 2-3 frasi (max 300 caratteri) che dice cosa trova e perché gli serve. Testo semplice, senza HTML.`;

async function scegliEScrivi(articoli) {
  const client = new Anthropic();
  const lista = articoli
    .map((a, i) => `${i + 1}. [${a.slug}] ${a.title}\n   categorie: ${a.categories.join(", ")}\n   estratto: ${a.blurb}`)
    .join("\n");
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Articoli usciti negli ultimi 7 giorni sul blog:\n\n${lista}\n\nScegli i migliori e scrivi oggetto, preheader, intro e blurb.` }],
  });
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

const pulisci = (s) => String(s).replace(/\s*[—–]\s*/g, ", ").replace(/!{2,}/g, "!").trim();
const P = (t) => `<p style="margin:0 0 14px 0;">${acapo(t)}</p>`;

async function inviaProva(html, subject) {
  const r = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GHL_EMAIL_TOKEN}`, Version: "2021-04-15", "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ type: "Email", contactId: CLAUDIO, subject: "[PROVA] " + subject, html, emailFrom: "Giovanni Perilli <info@funnelhacking.it>" }),
  });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}

async function linkHtmlSalvato(templateId) {
  // URL del file HTML salvato da GHL (serve all'attività Chrome per incollarlo nella campagna)
  const r = await fetch(`https://backend.leadconnectorhq.com/emails/builder/preview/${LOC}/${templateId}`);
  const m = (await r.text()).match(/src='([^']+index\.html[^']*)'/);
  return m ? m[1] : null;
}

async function main() {
  const fine = new Date(oggi);
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - 7);
  const tutti = await fetchArticles({ afterISO: inizio.toISOString().slice(0, 19), beforeISO: fine.toISOString().slice(0, 19), max: 40 });
  // articoli già mandati nelle edizioni precedenti (build/*-gp.json con "slugs") non si ripetono
  const giaInviati = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, "build")).filter((f) => /-gp\.json$/.test(f) && !f.startsWith(label))) {
    try { for (const s of JSON.parse(fs.readFileSync(path.join(ROOT, "build", f), "utf8")).slugs || []) giaInviati.add(s); } catch {}
  }
  const candidati = tutti.filter((a) => a.imageUrl && !giaInviati.has(a.slug) && !a.categories.some((c) => ESCLUDI_CATEGORIE.test(c)));
  console.log(`Articoli IT ultimi 7 giorni: ${tutti.length}, candidati (con copertina, senza Fotografia): ${candidati.length}`);
  if (!candidati.length) throw new Error("Nessun articolo utilizzabile negli ultimi 7 giorni");

  if (has("list")) {
    // elenco per chi scrive i testi (l'attività programmata): slug, titolo, categorie, estratto
    const out = candidati.map((a) => ({ slug: a.slug, title: a.title, date: a.dateISO, categories: a.categories, estratto: a.blurb, url: a.url }));
    fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "build", `${label}-gp.candidati.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const iContent = args.indexOf("--content");
  // --content <file.json> = testi già scritti {subject, preheader, intro, articoli:[{slug, blurb}]}; altrimenti Claude via API
  const copy = iContent >= 0 ? JSON.parse(fs.readFileSync(args[iContent + 1], "utf8")) : await scegliEScrivi(candidati);
  const bySlug = Object.fromEntries(candidati.map((a) => [a.slug, a]));
  const scelti = (copy.articoli || []).filter((x) => bySlug[x.slug]).slice(0, 4);
  if (!scelti.length) throw new Error("Claude non ha scelto articoli validi");

  const ed = {
    campaign: `nl-${label}`,
    title: `Newsletter GP — ${label}`,
    subject: pulisci(copy.subject),
    preheader: pulisci(copy.preheader),
    eyebrow: "La newsletter di Giovanni Perilli",
    introHtml: `<p style="margin:0;">${acapo(pulisci(copy.intro))}</p>`,
    box: {
      titolo: "Due modi per restare aggiornato",
      testo: "Sul canale Telegram trovi le novità su ads e AI appena escono. Su Substack scrivo note più brevi e personali su come lavoro con le campagne e con l’AI.",
    },
    sectionTitle: "Gli articoli da leggere",
    articles: scelti.map((x) => {
      const a = bySlug[x.slug];
      return { url: a.url, imageUrl: a.imageUrl, imageAlt: a.imageAlt, title: a.title, blurb: pulisci(x.blurb) };
    }),
    closingHtml:
      P("Se hai una domanda su uno di questi temi, rispondi a questa email: la leggo io. E se il canale ti sembra utile, giralo a un collega che lavora con le ads.") +
      `<p style="margin:0;">A presto,<br><strong>Giovanni Perilli</strong></p>`,
  };

  const html = buildEmail(ed);
  const testo = html.replace(/<(style|title)[^>]*>[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").toLowerCase();
  const spam = ["gratis", "gratuit", "offerta", "sconto", "urgente", "guadagn", "100%", "compra"].filter((w) => testo.includes(w));
  if (/[—–]/.test(testo.replace(/newsletter gp — /g, ""))) console.warn("ATTENZIONE: trattini lunghi nel testo");
  if (spam.length) console.warn("ATTENZIONE parole a rischio spam:", spam.join(", "));

  fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
  const htmlPath = path.join(ROOT, "build", `${label}-gp.html`);
  fs.writeFileSync(htmlPath, html);
  const stato = { data: label, title: ed.title, subject: ed.subject, preheader: ed.preheader, articoli: ed.articles.map((a) => a.title), slugs: scelti.map((x) => x.slug), htmlPath, spam, stato: "bozza-locale" };

  if (!has("dry")) {
    const t = await createHtmlEmail({ token: process.env.GHL_EMAIL_TOKEN, locationId: LOC, title: ed.title, html, updatedBy: process.env.GHL_USER_ID });
    Object.assign(stato, { templateId: t.templateId, previewUrl: t.previewUrl, htmlUrl: await linkHtmlSalvato(t.templateId), stato: "template-pronto" });
    if (!has("no-test")) {
      const p = await inviaProva(html, ed.subject);
      stato.provaClaudio = p.status === 201 ? "inviata" : `errore ${p.status}: ${p.body}`;
    }
  }
  fs.writeFileSync(path.join(ROOT, "build", `${label}-gp.json`), JSON.stringify(stato, null, 2));
  console.log(JSON.stringify(stato, null, 2));
}

main().catch((e) => { console.error("ERRORE:", e.message); process.exit(1); });
