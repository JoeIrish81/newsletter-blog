// test-invio.mjs — manda UNA mail di prova a un contatto GHL (Conversations API).
// node test-invio.mjs <contactId> <file.html> "<oggetto>"
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(new URL("./.env", import.meta.url), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()]));
const [contactId, file, subject] = process.argv.slice(2);
const html = fs.readFileSync(file, "utf8");
const r = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.GHL_EMAIL_TOKEN}`, Version: "2021-04-15", "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ type: "Email", contactId, subject: (process.env.NO_PREFIX ? "" : "[PROVA] ") + subject, html, emailFrom: "Giovanni Perilli <info@funnelhacking.it>" }),
});
console.log(r.status, (await r.text()).slice(0, 400));
