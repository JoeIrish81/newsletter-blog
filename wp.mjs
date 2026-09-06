// wp.mjs — legge gli articoli dal blog WordPress di giovanniperilli.com via REST API pubblica.
// Filtra la versione ITALIANA (il sito è multilingua: gli articoli EN hanno "/en/" nel link)
// e restituisce solo quelli usciti nella finestra temporale richiesta, dal più recente.

import { decodeEntities, dateLabel } from "./template.mjs";

const SITE = "https://giovanniperilli.com";

// estratto pulito: toglie tag, "[…]" finale, decodifica entità, taglia a fine frase entro ~maxLen
function cleanExcerpt(rendered, maxLen = 230) {
  let t = decodeEntities(
    rendered.replace(/<[^>]+>/g, "").replace(/\[(?:&hellip;|…|\.\.\.)\]/g, "").replace(/\s+/g, " ")
  ).trim();
  // molti estratti WP iniziano ripetendo un sotto-titolo: lo lasciamo, la copy verrà rifinita a mano
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

function pickImage(post) {
  const fm = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!fm) return "";
  const sizes = fm.media_details?.sizes || {};
  return (sizes.medium_large || sizes.large || sizes.medium || {}).source_url || fm.source_url || "";
}

/**
 * @param {{afterISO:string, beforeISO:string, max?:number}} opts
 * @returns {Promise<Array<{slug,url,imageUrl,imageAlt,date,dateISO,title,blurb,categories}>>}
 */
// Headers "da browser": alcuni host bloccano/servono pagine HTML alternative alle richieste
// senza User-Agent riconoscibile (tipico dei server cloud come Render). Con un UA da browser
// vero la richiesta passa come farebbe un visitatore normale.
const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

async function fetchJson(url, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    const raw = await res.text();
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("json")) {
      return JSON.parse(raw);
    }
    if (attempt >= retries) {
      throw new Error(`WP API ${res.status} (content-type "${contentType}"): ${raw.slice(0, 200)}`);
    }
    // probabile blocco/challenge momentaneo: un breve retry spesso basta
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function fetchArticles({ afterISO, beforeISO, max = 20 }) {
  const url = `${SITE}/wp-json/wp/v2/posts?per_page=50&_embed=1&orderby=date&order=desc`
    + `&after=${encodeURIComponent(afterISO)}&before=${encodeURIComponent(beforeISO)}`;
  const posts = await fetchJson(url, { retries: 2 });

  return posts
    .filter((p) => !p.link.includes("/en/"))          // solo italiano
    .filter((p) => p.status === "publish")
    .map((p) => ({
      slug: p.slug,
      url: p.link,
      imageUrl: pickImage(p),
      imageAlt: decodeEntities(p.title.rendered),
      title: decodeEntities(p.title.rendered),
      date: dateLabel(p.date),
      dateISO: p.date.slice(0, 10),
      blurb: cleanExcerpt(p.excerpt.rendered),
      categories: (p._embedded?.["wp:term"]?.[0] || []).map((t) => t.name),
    }))
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))
    .slice(0, max);
}
