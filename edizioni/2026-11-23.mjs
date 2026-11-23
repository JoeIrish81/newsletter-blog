// Edizione del 23/11/2026: lancio canale Telegram + Substack, 4 articoli Ads e AI.
// node edizioni/2026-11-23.mjs           → scrive build/2026-11-23-gp.html
// node edizioni/2026-11-23.mjs --push    → crea/aggiorna il template in GHL (Funnel Hacking GP)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildEmail } from "../template-gp.mjs";
import { acapo } from "../acapo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (t) => `<p style="margin:0 0 14px 0;">${acapo(t)}</p>`;

export const edizione = {
  campaign: "nl-2026-11-23",
  title: "Newsletter GP — 2026-11-23 — Telegram e Substack",
  subject: "Ho aperto un canale Telegram su ads e AI",
  subjectAlt: ["Un posto nuovo dove trovarmi (e 4 articoli)", "Ads e AI: ora anche su Telegram e Substack"],
  preheader: "Più quattro articoli: Gemini 4, il CPM nel Black Friday, i prompt per le ads e i reel copiati.",
  eyebrow: "La newsletter di Giovanni Perilli",
  introHtml:
    P("questa volta ti scrivo per una novità e per quattro articoli che secondo me vale la pena leggere adesso.") +
    `<p style="margin:0;">${acapo("Ho aperto un canale Telegram dedicato a ads e intelligenza artificiale. Ci metto le cose utili appena escono, in poche righe: un cambiamento su Meta, uno strumento AI che funziona davvero, un articolo nuovo del blog. Niente chat e niente messaggi a raffica.")}</p>`,
  box: {
    titolo: "Due modi per restare aggiornato",
    testo: "Su Telegram trovi le novità del giorno. Su Substack scrivo note più brevi e personali su come lavoro con le campagne e con l’AI. Scegli quello che usi di più, o tutti e due.",
  },
  sectionTitle: "Quattro articoli da leggere questa settimana",
  articles: [
    {
      url: "https://giovanniperilli.com/blog/gemini-4-claude-chatgpt-marketing/",
      imageUrl: "https://giovanniperilli.com/wp-content/uploads/2026/11/14-gemini-claude-chatgpt-it-1-768x432.jpg",
      imageAlt: "Gemini 4, Claude o ChatGPT: quale usare per il marketing",
      title: "Gemini 4, Claude o ChatGPT: quale usare per il lavoro di marketing",
      blurb:
        "Le classifiche dicono poco: Google stessa ha misurato Gemini 4 Carbon senza le protezioni attive. Io sceglierei in base al lavoro che affidi all’assistente, a dove stanno già i tuoi dati e a quanto costa ogni mese. Il confronto con prezzi e fonti ufficiali.",
    },
    {
      url: "https://giovanniperilli.com/blog/cpm-cose-come-si-calcola/",
      imageUrl: "https://giovanniperilli.com/wp-content/uploads/2026/11/18-cpm-it-1-768x432.jpg",
      imageAlt: "CPM, cos’è e cosa fare quando sale",
      title: "CPM: cos’è, come si calcola e cosa fare quando sale",
      blurb:
        "Con il Black Friday il CPM sale, come ogni anno. Prima di spegnere le campagne guarda quanto ti costa ogni contatto o ogni vendita: spesso un CPM alto è solo il prezzo di un pubblico più conteso. Quando preoccuparti davvero, con un esempio di calcolo.",
    },
    {
      url: "https://giovanniperilli.com/blog/prompt-per-inserzioni-chatgpt/",
      imageUrl: "https://giovanniperilli.com/wp-content/uploads/2026/11/prompt-per-inserzioni-chatgpt-copertina-768x432.jpg",
      imageAlt: "«Creami un’ads» non basta: il prompt è il riassunto della tua esperienza",
      title: "Perché «creami un’ads» non basta",
      blurb:
        "Se chiedi un annuncio in una riga ottieni lo stesso testo del tuo concorrente. Il prompt che funziona riassume la tua esperienza: costo per contatto, territorio, storico delle creatività. I quattro livelli di uso dell’AI nelle campagne e da dove partire.",
    },
    {
      url: "https://giovanniperilli.com/blog/content-protection-instagram/",
      imageUrl: "https://giovanniperilli.com/wp-content/uploads/2026/11/content-protection-instagram-it-768x432.jpg",
      imageAlt: "Instagram ora trova i reel copiati: come funziona Content Protection",
      title: "Content Protection di Instagram: lo strumento contro i reel copiati",
      blurb:
        "Dal 17 novembre Instagram cerca i video che copiano i tuoi, su Instagram e su Facebook, e ti lascia scegliere: nasconderli, aggiungere il link all’originale o lasciarli stare. Come funziona e chi può usarlo.",
    },
  ],
  closingHtml:
    P("Se hai una domanda su uno di questi temi, rispondi a questa email: la leggo io. E se il canale ti sembra utile, giralo a un collega che lavora con le ads.") +
    `<p style="margin:0;">A presto,<br><strong>Giovanni Perilli</strong></p>`,
};

const html = buildEmail(edizione);
fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
const out = path.join(ROOT, "build", "2026-11-23-gp.html");
fs.writeFileSync(out, html);
console.log("scritto", out, Math.round(Buffer.byteLength(html) / 1024) + " KB");

if (process.argv.includes("--push")) {
  const { createHtmlEmail } = await import("../ghl.mjs");
  const env = Object.fromEntries(
    fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()])
  );
  const r = await createHtmlEmail({
    token: env.GHL_EMAIL_TOKEN,
    locationId: env.GHL_LOCATION_ID || "65dgBotw4hBLniJ5BTL2",
    title: edizione.title,
    html,
    updatedBy: env.GHL_USER_ID,
  });
  console.log(JSON.stringify(r));
}
