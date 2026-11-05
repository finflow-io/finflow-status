// Verschickt Status-Meldungen per E-Mail an alle, die sich auf status.finflow.io
// angemeldet und die Anmeldung bestätigt haben (Resend: Segment
// "Status-Benachrichtigungen", Thema "Status-Meldungen").
//
// Wird vom Ablauf .github/workflows/notify-subscribers.yml bei neuen und
// geschlossenen Issues aufgerufen:
// - Label "status" geöffnet: Störung oder Einschränkung (legt Upptime an)
// - Label "status" geschlossen: behoben
// - Label "maintenance" geöffnet: geplante Wartung
// Ohne Secret RESEND_API_KEY passiert nichts.

import { readFileSync } from "node:fs";

const SEGMENT_ID = "0be4c7b3-9959-428f-b8aa-daa90c162c6e";
const TOPIC_ID = "a6c0f87f-a127-4de1-9f2a-fcfb9c895b02";
const FROM = "finflow Status <status@finflow.io>";
const SEITE = "https://status.finflow.io";
const NAVY = "#1C0A3C";
const GRAU = "#6B6581";

const key = process.env.RESEND_API_KEY;
if (!key) {
    console.log("RESEND_API_KEY fehlt, keine E-Mails verschickt.");
    process.exit(0);
}

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const { action, issue } = event;
const labels = (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));

const zeit = (iso) =>
    new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr";

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "🛑 App is down" → "App" */
function dienst(titel) {
    return titel
        .replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\s]+/u, "")
        .replace(/\s+(is down|has degraded performance|is up)\b.*$/i, "")
        .trim();
}

/** Werte aus dem Kommentarblock einer Wartungsmeldung (start, end) */
function wartungsdaten(body = "") {
    const block = body.match(/<!--([\s\S]*?)-->/)?.[1] ?? "";
    const wert = (name) => block.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
    return { start: wert("start"), ende: wert("end") };
}

function meldung() {
    if (labels.includes("status")) {
        const name = dienst(issue.title);
        const eingeschraenkt = /degraded/i.test(issue.title);
        if (action === "opened")
            return {
                betreff: eingeschraenkt ? `Eingeschränkt: ${name}` : `Störung: ${name}`,
                titel: eingeschraenkt ? `${name} reagiert langsamer als üblich` : `${name} ist gerade nicht erreichbar`,
                text: `Seit ${zeit(issue.created_at)} ${eingeschraenkt ? "reagiert" : "ist"} ${name} ${eingeschraenkt ? "langsamer als üblich" : "nicht erreichbar"}. Wir kümmern uns darum und schreiben dir, sobald alles wieder läuft.`,
                link: `${SEITE}/incident/${issue.number}`,
            };
        if (action === "closed") {
            const minuten = Math.max(1, Math.round((new Date(issue.closed_at) - new Date(issue.created_at)) / 60000));
            return {
                betreff: `Behoben: ${name} läuft wieder`,
                titel: `${name} läuft wieder`,
                text: `Seit ${zeit(issue.closed_at)} ist ${name} wieder normal erreichbar. Die Störung dauerte etwa ${minuten} ${minuten === 1 ? "Minute" : "Minuten"}.`,
                link: `${SEITE}/incident/${issue.number}`,
            };
        }
    }
    if (labels.includes("maintenance") && action === "opened") {
        const { start, ende } = wartungsdaten(issue.body);
        const zeitraum = start ? `Beginn: ${zeit(start)}${ende ? `, Ende voraussichtlich: ${zeit(ende)}` : ""}.` : "";
        return {
            betreff: `Geplante Wartung: ${issue.title}`,
            titel: `Geplante Wartung: ${issue.title}`,
            text: `Wir planen eine Wartung. ${zeitraum} In dieser Zeit können einzelne Dienste kurz nicht erreichbar sein.`.replace(/\s+/g, " ").trim(),
            link: `${SEITE}/incident/${issue.number}`,
        };
    }
    return null;
}

function html({ titel, text, link }) {
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7F6FA;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F7F6FA" style="background-color:#F7F6FA;"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;">
<tr><td style="padding-top:32px;padding-left:32px;padding-right:32px;"><img src="https://finflow.io/email/finflow-logo-navy.png" width="128" height="24" border="0" alt="finflow" style="display:block;"></td></tr>
<tr><td style="padding-top:28px;padding-left:32px;padding-right:32px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:${NAVY};font-weight:bold;">${escape(titel)}</td></tr>
<tr><td style="padding-top:12px;padding-left:32px;padding-right:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${NAVY};">${escape(text)}</td></tr>
<tr><td style="padding-top:24px;padding-left:32px;padding-right:32px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${NAVY}" style="background-color:${NAVY};border-radius:12px;"><a href="${link}" style="display:inline-block;padding-top:12px;padding-bottom:12px;padding-left:20px;padding-right:20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;color:#FFFFFF;text-decoration:none;font-weight:bold;">Zur Statusseite</a></td></tr></table></td></tr>
<tr><td style="padding-top:24px;padding-left:32px;padding-right:32px;padding-bottom:32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${GRAU};">Du erhältst diese E-Mail, weil du dich auf status.finflow.io für Status-Meldungen angemeldet hast. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${GRAU};">Abmelden</a><br><br>finflow GmbH, Am Sandtorkai 27, 20457 Hamburg · <a href="https://finflow.io/de/rechtliches/impressum" style="color:${GRAU};">Impressum</a> · <a href="https://finflow.io/de/rechtliches/datenschutz-status" style="color:${GRAU};">Datenschutz</a></td></tr>
</table></td></tr></table></body></html>`;
}

async function resend(pfad, body) {
    const res = await fetch(`https://api.resend.com${pfad}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Resend ${pfad} → ${res.status} ${text}`);
    return text ? JSON.parse(text) : {};
}

const m = meldung();
if (!m) {
    console.log(`Keine Meldung für ${action} (${labels.join(", ")}).`);
    process.exit(0);
}
const text = `${m.titel}\n\n${m.text}\n\nZur Statusseite: ${m.link}\n\nDu erhältst diese E-Mail, weil du dich auf status.finflow.io für Status-Meldungen angemeldet hast. Abmelden: {{{RESEND_UNSUBSCRIBE_URL}}}\n\nfinflow GmbH, Am Sandtorkai 27, 20457 Hamburg`;
const broadcast = await resend("/broadcasts", {
    segment_id: SEGMENT_ID,
    topic_id: TOPIC_ID,
    from: FROM,
    reply_to: "hello@finflow.io",
    subject: m.betreff,
    name: `Status #${issue.number} ${action}`,
    html: html(m),
    text,
});
await resend(`/broadcasts/${broadcast.id}/send`);
console.log(`Verschickt: ${m.betreff}`);
