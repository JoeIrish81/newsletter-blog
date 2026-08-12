// template.mjs — costruisce l'HTML della newsletter "La settimana in digital".
// Riproduce ESATTAMENTE il template usato su GoHighLevel (tabelle inline, condizionali mso,
// colore brand #D2722E). L'output di buildEmailTable() è il blocco <table> da incollare
// nell'elemento "custom code" di GHL, identico a com'era prima.

const BRAND = "#D2722E";

// --- utilità testo ---------------------------------------------------------
const ENT = {
  "&#8217;": "’", "&#8216;": "‘", "&#8230;": "…", "&hellip;": "…",
  "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&#8212;": "—",
  "&#038;": "&", "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&quot;": '"',
  "&#8242;": "′", "&egrave;": "è", "&agrave;": "à", "&#232;": "è",
};
export function decodeEntities(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#8217;|&#8216;|&#8230;|&hellip;|&#8220;|&#8221;|&#8211;|&#8212;|&#038;|&amp;|&nbsp;|&#039;|&quot;|&egrave;|&agrave;/g, (m) => ENT[m] || m)
    .trim();
}

const MESI = ["GENNAIO","FEBBRAIO","MARZO","APRILE","MAGGIO","GIUGNO","LUGLIO","AGOSTO","SETTEMBRE","OTTOBRE","NOVEMBRE","DICEMBRE"];
export function dateLabel(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

const NUM = ["zero","Un","Due","Tre","Quattro","Cinque","Sei","Sette","Otto","Nove","Dieci","Undici","Dodici"];
export const numeroInLettere = (n) => NUM[n] || String(n);

// --- blocchi ---------------------------------------------------------------
function articleBlock({ url, imageUrl, imageAlt, date, title, blurb }, first) {
  const topPad = first ? "20px" : "24px";
  return `
        <tr>
          <td style="padding:${topPad} 36px 0 36px;">
            <a href="${url}" style="text-decoration:none;">
              <img src="${imageUrl}" width="300" alt="${imageAlt}" style="width:100%;max-width:300px;border-radius:8px;display:block;" />
            </a>
            <div style="font-size:12px;color:#9a9a9a;padding-top:12px;">${date}</div>
            <h3 style="margin:4px 0 8px 0;font-size:19px;line-height:1.35;color:#1a1a1a;">
              <a href="${url}" style="color:#1a1a1a;text-decoration:none;; mso-style-textfill-fill-color: #1a1a1a;"><!--[if mso]><font color="#1a1a1a"><![endif]-->${title}<!--[if mso]></font><![endif]--></a>
            </h3>
            <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#454545;">
              ${blurb}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="border-radius:8px;background-color:${BRAND};">
                <a href="${url}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;; mso-style-textfill-fill-color: #ffffff;"><!--[if mso]><font color="#ffffff"><![endif]-->Leggi l’articolo →<!--[if mso]></font><![endif]--></a>
              </td>
            </tr></table>
          </td>
        </tr>`;
}

const divider = `
        <tr><td style="padding:26px 36px 0 36px;"><div style="height:1px;background-color:#e7e7e7;font-size:0;line-height:1px;">&nbsp;</div></td></tr>`;

const WHY_BOX_DEFAULT = `
                  <p style="margin:0 0 10px 0;font-weight:bold;color:#1a1a1a;">Perché dovrebbero interessarti:</p>
                  <p style="margin:0 0 8px 0;">\u{1F449} <strong>Se fai digital in prima persona</strong> — per restare in regola e lavorare meglio, senza brutte sorprese.</p>
                  <p style="margin:0 0 8px 0;">\u{1F449} <strong>Se deleghi alla tua agenzia</strong> — per fare le domande giuste a chi lavora per te.</p>
                  <p style="margin:0;">\u{1F449} <strong>Se sei curioso di come evolve il digital marketing</strong> — per capire dove sta andando, prima degli altri.</p>`;

// --- documento -------------------------------------------------------------
export function buildEmailTable({ eyebrow, greeting, introHtml, whyBoxHtml, articles, closingHtml }) {
  const blocks = articles
    .map((a, i) => articleBlock(a, i === 0))
    .join(divider);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f4;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="padding:28px 36px 0 36px;">
            <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${BRAND};font-weight:bold;">${eyebrow}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 36px 0 36px;">
            <h1 style="margin:0;font-size:26px;line-height:1.25;color:#1a1a1a;">${greeting}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px 0 36px;font-size:16px;line-height:1.6;color:#2b2b2b;">
            ${introHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 0 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf5ef;border-left:4px solid ${BRAND};border-radius:6px;">
              <tr>
                <td style="padding:18px 20px;font-size:15px;line-height:1.6;color:#2b2b2b;">${whyBoxHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px 4px 36px;">
            <h2 style="margin:0;font-size:20px;color:#1a1a1a;">\u{1F4CC} Gli articoli della settimana</h2>
          </td>
        </tr>${blocks}
        <tr><td style="padding:30px 36px 0 36px;"><div style="height:1px;background-color:#e7e7e7;font-size:0;line-height:1px;">&nbsp;</div></td></tr>
        <tr>
          <td style="padding:22px 36px 0 36px;font-size:16px;line-height:1.6;color:#2b2b2b;">
            ${closingHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 36px 6px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="border-radius:8px;background-color:${BRAND};">
                <a href="https://giovanniperilli.com/blog/" style="display:inline-block;padding:14px 34px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;; mso-style-textfill-fill-color: #ffffff;"><!--[if mso]><font color="#ffffff"><![endif]-->\u{1F449} Vai al blog<!--[if mso]></font><![endif]--></a>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 36px 30px 36px;">
            <div style="height:1px;background-color:#e7e7e7;font-size:0;line-height:1px;margin-bottom:18px;">&nbsp;</div>
            <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#8a8a8a;">Ricevi questa email perché sei iscritto agli aggiornamenti di Giovanni Perilli.</p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#8a8a8a;">
              <a href="{{unsubscribe_link}}" style="color:#8a8a8a;text-decoration:underline;; mso-style-textfill-fill-color: #8a8a8a;"><!--[if mso]><font color="#8a8a8a"><![endif]-->Disiscriviti<!--[if mso]></font><![endif]--></a>
              &nbsp;•&nbsp;
              <a href="https://giovanniperilli.com" style="color:#8a8a8a;text-decoration:underline;; mso-style-textfill-fill-color: #8a8a8a;"><!--[if mso]><font color="#8a8a8a"><![endif]-->giovanniperilli.com<!--[if mso]></font><![endif]--></a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export const DEFAULTS = {
  eyebrow: "La settimana in digital",
  greeting: "Ciao {{contact.first_name}},",
  whyBoxHtml: WHY_BOX_DEFAULT,
  closingHtml: `<p style="margin:0 0 14px 0;">Se uno di questi temi ti tocca da vicino, rispondi pure a questa mail: leggo tutto.</p>
            <p style="margin:0;">Alla prossima,<br><strong>Giovanni</strong></p>`,
};

// Avvolge il blocco in un documento completo, solo per l'anteprima locale nel browser.
export function wrapPreview(tableHtml, subject = "Anteprima newsletter") {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;">${tableHtml}</body></html>`;
}
