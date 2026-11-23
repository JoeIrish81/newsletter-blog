// Regola giornalistica di a capo (richiesta di Giovanni, 12/11/2026), da usare per OGNI titolo/testo impaginato in HTML:
// mai articoli, preposizioni, congiunzioni, pronomi atoni o numeri a fine riga; niente vedove (ultima parola da sola).
// Uso: import { acapo, CSS_ACAPO } from ".../strumenti-tipografia/acapo.mjs"; html = acapo(testoGiàEscapato)
// Lega con spazi non separabili le parole corte alla successiva, i numeri all'unità e le ultime due parole di ogni riga.
// In più metti nel CSS del titolo CSS_ACAPO (text-wrap:balance) per righe equilibrate.
export const CORTE = "il lo la i gli le un uno una di a da in con su per tra fra e ed o od ma che non mi ti si ci vi ne se del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col è poi più come quando dove cui quale quali cosa ecco mio mia tuo tua suo sua nostro nostra vostro vostra loro anche già sia né the a an of to in on at by for with and or but from el los las unos unas y u ni pero por para sin sobre entre hasta desde según qué cómo cuándo nos les sus tu es muy más de en que su mi te how what your its is are".split(" ");
export const CSS_ACAPO = "text-wrap:balance;";
export function acapo(h) {
  if (!h) return h;
  const parti = String(h).split(/(<[^>]+>)/);
  for (let i = 0; i < parti.length; i++) {
    if (parti[i].startsWith("<")) continue;
    parti[i] = parti[i]
      .replace(/(?<=^|[\s(«"'’;])([A-Za-zÀ-ÿ]+) +(?=\S|$)/g, (m, w) => (CORTE.includes(w.toLowerCase()) ? `${w} ` : m))
      .replace(/(\d[\d.,]*) +(?=\S|$)/g, "$1 ");
  }
  return parti.join("").split(/<br\s*\/?>/).map((r) => r.replace(/ ([^ <>]+(?:<\/[a-z]+>)?[^ <>]*)$/, " $1")).join("<br>");
}
