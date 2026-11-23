// template-gp.mjs — newsletter di Giovanni Perilli dalla postazione GHL «Funnel Hacking GP».
// Footer = quello REALE delle mail che funzionano (anteprima GHL 6b044f59208c95a6cb034f69, 23/11/2026):
// icone social + barra arancione #ed4b16 con ©, consenso tracciamento e disiscrizione via trigger link.
// NON sostituire i trigger link con {{unsubscribe_link}}: la disiscrizione passa dal workflow
// «Annulla Iscrizione Email» collegato a {{trigger_link.7cgkWTlxJPE7skKItREJ}}.

import { acapo } from "./acapo.mjs";

export const ORANGE = "#ed4b16";
const INK = "#1a1a1a";
const TEXT = "#2b2b2b";
const MUTED = "#6b6b6b";
const FONT = "Arial,Helvetica,sans-serif";

export const TRIGGER_CONSENSO = "{{trigger_link.pl5mK5NMIjLsFbM3UCla}}";
export const TRIGGER_DISISCRIZIONE = "{{trigger_link.7cgkWTlxJPE7skKItREJ}}";

export const LINK = {
  telegram: "https://t.me/gioperilli_ads",
  substack: "https://substack.com/@giovanniperilli",
  blog: "https://giovanniperilli.com/blog/",
};

// Footer standard di TUTTE le mail di Giovanni (regola del 23/11/2026): 7 icone, in quest'ordine.
// Telegram e Substack non esistono tra le icone GHL: le abbiamo disegnate (icone/) e caricate nei file GHL.
const GHL_ICON = (n) => `https://storage.googleapis.com/preview-production-assets/email/img/hl_default_img/social/${n}_circle_color.png`;
const SOCIAL = [
  ["Facebook", "https://www.facebook.com/TheFunnelSocialManager", GHL_ICON("facebook")],
  ["Instagram", "https://www.instagram.com/gioperilli/", GHL_ICON("instagram")],
  ["LinkedIn", "https://www.linkedin.com/in/giovanniperilli/", GHL_ICON("linkedin")],
  ["YouTube", "https://www.youtube.com/channel/UC9kTqvyOcA1ei7As0eJxP0Q", GHL_ICON("youtube")],
  ["TikTok", "https://www.tiktok.com/@gio.perilli", GHL_ICON("tiktok")],
  ["Telegram", "https://t.me/gioperilli_ads", "https://files.leadconnectorhq.com/file/6b0452fad40dd20617c5c0e7/telegram-circle-color.png"],
  ["Substack", "https://substack.com/@giovanniperilli", "https://files.leadconnectorhq.com/file/6b0452fb306ac23751ac5a45/substack-circle-color.png"],
];

export function utm(url, campaign) {
  if (!/giovanniperilli\.com/.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=newsletter&utm_medium=email&utm_campaign=${encodeURIComponent(campaign)}`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function button(href, label, bg, color = "#ffffff") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
              <td align="center" bgcolor="${bg}" style="border-radius:8px;background-color:${bg};">
                <a href="${href}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:16px;font-weight:bold;line-height:20px;color:${color};text-decoration:none;border-radius:8px;mso-style-textfill-fill-color:${color};"><!--[if mso]><font color="${color}"><![endif]-->${label}<!--[if mso]></font><![endif]--></a>
              </td>
            </tr></table>`;
}

function article(a, campaign, first) {
  const url = utm(a.url, campaign);
  const img = a.imageUrl
    ? `<a href="${url}" target="_blank" style="text-decoration:none;"><img src="${a.imageUrl}" width="528" alt="${esc(a.imageAlt || a.title)}" style="width:100%;max-width:528px;height:auto;border:0;border-radius:8px;display:block;" /></a>`
    : "";
  return `
        <tr>
          <td style="padding:${first ? "18px" : "30px"} 36px 0 36px;font-family:${FONT};">
            ${img}
            <h3 style="margin:14px 0 8px 0;font-family:${FONT};font-size:20px;line-height:1.35;color:${INK};text-wrap:balance;">
              <a href="${url}" target="_blank" style="color:${INK};text-decoration:none;mso-style-textfill-fill-color:${INK};">${acapo(esc(a.title))}</a>
            </h3>
            <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#454545;">${acapo(a.blurb)}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;"><a href="${url}" target="_blank" style="color:${ORANGE};font-weight:bold;text-decoration:underline;mso-style-textfill-fill-color:${ORANGE};">Leggi l’articolo</a></p>
          </td>
        </tr>`;
}

const rule = (top = 28) =>
  `<tr><td style="padding:${top}px 36px 0 36px;"><div style="height:1px;background-color:#e7e7e7;font-size:0;line-height:1px;">&nbsp;</div></td></tr>`;

function socialRow() {
  const cells = SOCIAL.map(
    ([name, href, icon]) =>
      `<td style="padding:0 6px;"><a href="${href}" target="_blank"><img src="${icon}" width="24" height="24" alt="${name}" style="display:block;border:0;border-radius:3px;" /></a></td>`
  ).join("");
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}

// Footer reale: testi e link esattamente come nelle mail GHL che funzionano.
export function footer() {
  return `
  <tr>
    <td align="center" style="padding:22px 20px 18px 20px;background-color:#ffffff;">${socialRow()}</td>
  </tr>
  <tr>
    <td align="center" bgcolor="${ORANGE}" style="background-color:${ORANGE};padding:14px 24px;font-family:${FONT};font-size:12px;line-height:1.5;color:#ffffff;">
      <p style="margin:0 0 6px 0;color:#ffffff;">© {{right_now.year}} Tutti i diritti riservati</p>
      <p style="margin:0;color:#ffffff;">
        <a href="${TRIGGER_CONSENSO}" target="_blank" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:underline;mso-style-textfill-fill-color:#ffffff;"><!--[if mso]><font color="#ffffff"><![endif]-->Gestisci il consenso al tracciamento (rif. Provvedimento del Garante n. 284/2026)<!--[if mso]></font><![endif]--></a><br>
        <a href="${TRIGGER_DISISCRIZIONE}" target="_blank" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:underline;mso-style-textfill-fill-color:#ffffff;"><!--[if mso]><font color="#ffffff"><![endif]-->Clicca qui per disiscriverti dalle liste<!--[if mso]></font><![endif]--></a>
      </p>
    </td>
  </tr>`;
}

// Box iscrizione Telegram + Substack (in apertura, ogni settimana).
export function iscrizioniBox({ titolo, testo }) {
  return `
        <tr>
          <td style="padding:22px 36px 0 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff4ee;border-radius:10px;border:1px solid #f6d3c4;">
              <tr><td style="padding:22px 22px 6px 22px;font-family:${FONT};text-align:center;">
                <p style="margin:0 0 8px 0;font-size:18px;line-height:1.35;font-weight:bold;color:${INK};text-wrap:balance;">${acapo(titolo)}</p>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${TEXT};">${acapo(testo)}</p>
              </td></tr>
              <tr><td style="padding:0 22px 10px 22px;">${button(LINK.telegram, "Entra nel canale Telegram", "#1f8fd0")}</td></tr>
              <tr><td style="padding:0 22px 22px 22px;">${button(LINK.substack, "Seguimi su Substack", "#ff6719")}</td></tr>
            </table>
          </td>
        </tr>`;
}

export function buildEmail({ subject, preheader, campaign, eyebrow, introHtml, box, sectionTitle, articles, closingHtml }) {
  const blocks = articles.map((a, i) => article(a, campaign, i === 0)).join("\n" + rule(30));
  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(subject)}</title>
<style>
  body{margin:0;padding:0;}
  img{-ms-interpolation-mode:bicubic;}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
  @media only screen and (max-width:620px){
    .wrap{width:100%!important;}
    .px td{padding-left:20px!important;padding-right:20px!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f4;">
  <tr>
    <td align="center" style="padding:24px 10px;">
      <table role="presentation" class="wrap px" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:28px 36px 0 36px;font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;color:${ORANGE};">${esc(eyebrow)}</td>
        </tr>
        <tr>
          <td style="padding:10px 36px 0 36px;font-family:${FONT};">
            <h1 style="margin:0;font-size:24px;line-height:1.3;color:${INK};">Ciao {{contact.first_name}},</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 36px 0 36px;font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};">${introHtml}</td>
        </tr>${iscrizioniBox(box)}
        <tr>
          <td style="padding:32px 36px 0 36px;font-family:${FONT};">
            <h2 style="margin:0;font-size:20px;line-height:1.3;color:${INK};text-wrap:balance;">${acapo(esc(sectionTitle))}</h2>
          </td>
        </tr>${blocks}
        ${rule(32)}
        <tr>
          <td style="padding:22px 36px 0 36px;font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};">${closingHtml}</td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 36px 8px 36px;">${button(utm(LINK.blog, campaign), "Vai al blog", ORANGE)}</td>
        </tr>${footer()}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
