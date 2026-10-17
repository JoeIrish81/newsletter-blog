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
// User-Agent ONESTO: da ottobre 2026 SiteGround risponde 403 a chi si dichiara Chrome ma non
// lo è (UA da browser + impronta TLS di Node = bot camuffato). Un UA dichiarato da script passa.
const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent": "newsletter-blog/1.0 (+https://giovanniperilli.com)",
};

// Il firewall del sito (SiteGround Security) a volte mette in sfida ("sgcaptcha") solo il
// percorso pretty-permalink /wp-json/... quando arriva da IP di datacenter (Render). La stessa
// query passando da index.php (?rest_route=...) di norma non è coperta dalla stessa regola.
function restRouteUrl(prettyUrl) {
  const u = new URL(prettyUrl);
  const route = u.pathname.replace(/^\/wp-json/, "");
  const qs = new URLSearchParams(u.search);
  qs.set("rest_route", route);
  return `${u.origin}/?${qs.toString()}`;
}

async function fetchOnce(url) {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  const raw = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (res.ok && contentType.includes("json")) return JSON.parse(raw);
  const err = new Error(`WP API ${res.status} (content-type "${contentType}"): ${raw.slice(0, 200)}`);
  err.blocked = /sgcaptcha|captcha|challenge/i.test(raw);
  throw err;
}

// Prova prima l'URL pretty-permalink; se viene bloccato (sfida/captcha) passa alla forma
// ?rest_route= che di solito bypassa quella specifica regola del firewall. Ritenta con
// backoff crescente perché la sfida è spesso temporanea (rate-limit, non ban permanente).
async function fetchJson(prettyUrl, { retries = 3, delayMs = 4000 } = {}) {
  const altUrl = restRouteUrl(prettyUrl);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const url = attempt === 0 ? prettyUrl : altUrl;
    try {
      return await fetchOnce(url);
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function fetchArticles({ afterISO, beforeISO, max = 20 }) {
  const url = `${SITE}/wp-json/wp/v2/posts?per_page=50&_embed=1&orderby=date&order=desc`
    + `&after=${encodeURIComponent(afterISO)}&before=${encodeURIComponent(beforeISO)}`;
  const posts = await fetchJson(url);

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
