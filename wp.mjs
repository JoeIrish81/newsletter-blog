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
export async function fetchArticles({ afterISO, beforeISO, max = 20 }) {
  const url = `${SITE}/wp-json/wp/v2/posts?per_page=50&_embed=1&orderby=date&order=desc`
    + `&after=${encodeURIComponent(afterISO)}&before=${encodeURIComponent(beforeISO)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`WP API ${res.status}: ${await res.text().catch(() => "")}`);
  const posts = await res.json();

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
