// copy.mjs — genera la copy editoriale della newsletter con Claude (SDK ufficiale Anthropic).
// Serve per il run automatico su Render (il venerdì non c'è nessuno a scriverla a mano):
// dai gli articoli grezzi, torna intro + blurb curate nel tono di Giovanni.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5"; // per risparmiare: CLAUDE_MODEL=claude-sonnet-5

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    introTopics: {
      type: "string",
      description: "Inner HTML del secondo paragrafo dell'intro: una frase che cita i temi della settimana e chiude con il conteggio articoli. NIENTE riferimenti temporali (giorni della settimana, 'oggi', ecc.): la mail viene rinviata anche nei giorni dopo. Può usare <strong> e &mdash;.",
    },
    blurbs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string" },
          html: { type: "string", description: "2-3 frasi, tono editoriale, può usare <strong>/<em>. Niente virgolette doppie non-HTML." },
        },
        required: ["slug", "html"],
      },
    },
  },
  required: ["introTopics", "blurbs"],
};

const SYSTEM = `Sei il copywriter della newsletter settimanale "La settimana in digital" di Giovanni Perilli, esperto di digital marketing. Scrivi in italiano, tono diretto, concreto e un po' opinionato, come parla lui: niente fuffa, niente "in questo articolo scoprirai". Ogni blurb spiega perché l'articolo conta per chi fa/delega marketing. Usa <strong> per 1-2 concetti chiave e <em> con parsimonia. Mantieni le blurb brevi (2-3 frasi). Non inventare fatti oltre a titolo ed estratto forniti.`;

/**
 * @param {Array<{slug,title,blurb,date}>} articles  (blurb = estratto WP grezzo)
 * @returns {Promise<{introTopics:string, blurbs:Record<string,string>}>}
 */
export async function generateCopy(articles) {
  const client = new Anthropic(); // legge ANTHROPIC_API_KEY dall'ambiente
  const lista = articles
    .map((a, i) => `${i + 1}. [${a.slug}] ${a.date} — ${a.title}\n   estratto: ${a.blurb}`)
    .join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Ecco gli articoli della settimana (${articles.length}), dal più recente:\n\n${lista}\n\nScrivi:\n- introTopics: il secondo paragrafo dell'intro (il primo è fisso: "Come sempre, ti faccio il punto della settimana."), che cita in scioltezza i 2-3 temi forti e chiude con "${articles.length} articoli, te li ho messi in fila dal più recente." NIENTE riferimenti a giorni o momenti.\n- blurbs: una blurb per ogni articolo, riferita per slug.`,
    }],
  });

  const text = res.content.find((b) => b.type === "text")?.text || "{}";
  const parsed = JSON.parse(text);
  const map = {};
  for (const b of parsed.blurbs || []) map[b.slug] = b.html;
  return { introTopics: parsed.introTopics || "", blurbs: map };
}
