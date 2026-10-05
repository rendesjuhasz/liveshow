import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { publicFrontendUrl } from "../auth/public-url";

import { translate } from "../i18n/messages";
import { formatInTimeZone } from "../time/timezone";

export const MAIL_TYPES = {
    registration: "registration",
    ticket_purchased: "ticket_purchased",
    live_reminder: "live_reminder",
    archive_ready: "archive_ready",
    streamer_approved: "streamer_approved",
    payout_approved: "payout_approved",
    payout_requested: "payout_requested",
    payout_paid: "payout_paid",
    contact_admin: "contact_admin",
    contact_user: "contact_user",
    password_reset: "password_reset",
    email_verification: "email_verification",
    follow_event: "follow_event",
    ops_alert: "ops_alert",
    safety_alert: "safety_alert",
} as const;

export type MailType = (typeof MAIL_TYPES)[keyof typeof MAIL_TYPES];

const FRONTEND = () => publicFrontendUrl();

function wrap(title: string, body: string, locale = "hu") {
    return {
        subject: `LiveShow · ${title}`,
        text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        html: `<!DOCTYPE html><html lang="${locale}"><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#eee;padding:24px">
<div style="max-width:560px;margin:auto;background:#171717;border:1px solid #333;border-radius:16px;padding:24px">
<h1 style="color:#facc15;font-size:20px">LiveShow</h1>
${body}
<p style="color:#888;font-size:12px;margin-top:24px">${translate("email.footer", locale)}</p>
</div></body></html>`,
    };
}

export function registrationEmail(isStreamer: boolean, locale = "hu", verifyUrl?: string) {
    const extra = isStreamer
        ? `<p>${translate("email.welcomeStreamer", locale)}</p>`
        : `<p>${translate("email.watchFree", locale)}</p>`;
    const confirm = verifyUrl
        ? `<p>${translate("email.verifyBody", locale)}</p>
<p>${translate("email.verifyTtl", locale)}</p>
<p><a href="${escapeHtml(verifyUrl)}" style="color:#facc15">${translate("email.verifyCta", locale)}</a></p>
<p style="word-break:break-all;color:#aaa;font-size:12px">${escapeHtml(verifyUrl)}</p>`
        : `<p><a href="${FRONTEND()}/login" style="color:#facc15">${translate("auth.submitLogin", locale)}</a></p>`;
    return wrap(
        translate("email.registrationSubject", locale),
        `<p>${translate("email.welcome", locale)}</p>${extra}${confirm}`,
        locale,
    );
}

export function emailVerificationEmail(verifyUrl: string, locale = "hu") {
    return wrap(
        translate("email.verifySubject", locale),
        `<p>${translate("email.verifyBody", locale)}</p>
<p>${translate("email.verifyTtl", locale)}</p>
<p><a href="${escapeHtml(verifyUrl)}" style="color:#facc15">${translate("email.verifyCta", locale)}</a></p>
<p style="word-break:break-all;color:#aaa;font-size:12px">${escapeHtml(verifyUrl)}</p>
<p>${translate("email.resetIgnore", locale)}</p>`,
        locale,
    );
}

export function ticketPurchasedEmail(showTitle: string, showId: string, locale = "hu") {
    return wrap(
        translate("email.ticketSubject", locale),
        `<p>${translate("email.ticketBody", locale)} <strong>${escapeHtml(showTitle)}</strong>.</p>
<p><a href="${FRONTEND()}/shows/${showId}" style="color:#facc15">${translate("email.openShow", locale)}</a></p>`,
        locale,
    );
}

export function packPurchasedEmail(groupName: string, ticketCount: number, locale = "hu") {
    return wrap(
        translate("email.ticketSubject", locale),
        `<p>${translate("email.packBody", locale)} <strong>${escapeHtml(groupName)}</strong> (${ticketCount}).</p>
<p><a href="${FRONTEND()}/profile" style="color:#facc15">${translate("nav.profile", locale)}</a></p>`,
        locale,
    );
}

export function followShowEmail(title: string, body: string, href: string, locale = "hu") {
    const base = FRONTEND().replace(/\/$/, "");
    const url = href.startsWith("http") ? href : `${base}${href}`;
    const htmlBody = escapeHtml(body).replace(/\n/g, "<br/>");
    return wrap(
        title,
        `<p>${htmlBody}</p>
<p><a href="${escapeHtml(url)}" style="color:#facc15">Megnyitás</a></p>`,
        locale,
    );
}

export function liveReminderEmail(
    showTitle: string,
    showId: string,
    startTime: Date | null,
    locale = "hu",
    timeZone = "Europe/Budapest",
) {
    const when = startTime
        ? `${formatInTimeZone(startTime, timeZone, locale === "hu" ? "hu-HU" : locale)} (${timeZone})`
        : translate("email.soon", locale);
    return wrap(
        translate("email.liveReminderSubject", locale),
        `<p>${translate("email.reminderBody", locale)} <strong>${escapeHtml(showTitle)}</strong></p>
<p>${translate("email.start", locale)}: ${escapeHtml(when)}</p>
<p><a href="${FRONTEND()}/live/${showId}" style="color:#facc15">${translate("email.enterLive", locale)}</a></p>`,
        locale,
    );
}

export function archiveReadyEmail(showTitle: string, showId: string) {
    return wrap(
        "Archívum elkészült",
        `<p>Elérhető az archív felvétel: <strong>${escapeHtml(showTitle)}</strong></p>
<p><a href="${FRONTEND()}/archive/${showId}" style="color:#facc15">Archívum lejátszása</a></p>`,
    );
}

export function streamerApprovedEmail(name: string) {
    return wrap(
        "Tartalomkészítő fiók jóváhagyva",
        `<p>Kedves ${escapeHtml(name)}!</p>
<p>Tartalomkészítő fiókodat jóváhagytuk. Mostantól elérhető a vezérlőpult.</p>
<p><a href="${FRONTEND()}/streamer" style="color:#facc15">Tartalomkészítő felület</a></p>`,
    );
}

export function payoutRequestedEmail(streamerName: string, amount: number) {
    return wrap(
        "Új kifizetési igény",
        `<p><strong>${escapeHtml(streamerName)}</strong> kifizetést igényelt: <strong>${amount} Ft</strong>.</p>
<p><a href="${FRONTEND()}/admin/payments" style="color:#facc15">Admin kifizetések</a></p>`,
    );
}

export function payoutPaidEmail(amount: number) {
    return wrap(
        "Kifizetés teljesítve",
        `<p>A kifizetésed teljesült: <strong>${amount} Ft</strong>.</p>
<p>A bizonylatot a Kifizetések menüben töltheted le.</p>
<p><a href="${FRONTEND()}/streamer/payouts" style="color:#facc15">Kifizetések</a></p>`,
    );
}

export function payoutApprovedEmail(amount: number) {
    return wrap(
        "Kifizetés jóváhagyva",
        `<p>A kifizetési igényed folyamatba került: <strong>${amount} Ft</strong>.</p>
<p>A tényleges utalás a „kifizetve” státusz után történik.</p>
<p><a href="${FRONTEND()}/streamer/payouts" style="color:#facc15">Kifizetések</a></p>`,
    );
}

export function passwordResetEmail(resetUrl: string, locale = "hu") {
    return wrap(
        translate("email.passwordResetSubject", locale),
        `<p>${translate("email.resetBody", locale)}</p>
<p>${translate("email.resetTtl", locale)}</p>
<p><a href="${escapeHtml(resetUrl)}" style="color:#facc15">${translate("email.resetCta", locale)}</a></p>
<p style="word-break:break-all;color:#aaa;font-size:12px">${escapeHtml(resetUrl)}</p>
<p>${translate("email.resetIgnore", locale)}</p>`,
        locale,
    );
}

export function contactAdminEmail(name: string, email: string, message: string) {
    return wrap(
        "Új üzenet a Kapcsolat űrlapról",
        `<p>Új üzenet érkezett a Kapcsolat űrlapon.</p>
<p><strong>Név:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Üzenet:</strong></p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    );
}

export function contactUserEmail(name: string) {
    const who = name.trim() ? escapeHtml(name.trim()) : "Kedves Felhasználó";
    return wrap(
        "Megkaptuk az üzenetedet",
        `<p>Kedves ${who}!</p>
<p><strong>Köszönjük!</strong></p>
<p>Megkaptuk az üzenetedet, hamarosan válaszolunk.</p>`,
    );
}

export function safetyAlertEmail(title: string, body: string) {
    const html = `<p>${String(body || "").replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`;
    return wrap(`AI Safety · ${title}`, html);
}

export function opsAlertEmail(input: {
    kind: string;
    service: string;
    message: string;
    detail?: string | null;
    showId?: string | null;
    streamId?: string | null;
    env?: string;
    extra?: string | null;
}) {
    const env = input.env || process.env.NODE_ENV || "development";
    const time = new Date().toISOString();
    const rows = [
        ["Időpont", time],
        ["Környezet", env],
        ["Szolgáltatás", input.service],
        ["Esemény", input.kind],
        ["Hiba", input.message],
        input.detail ? ["Részlet", input.detail] : null,
        input.showId ? ["Show ID", input.showId] : null,
        input.streamId ? ["Stream ID", input.streamId] : null,
        input.extra ? ["Extra", input.extra] : null,
    ].filter(Boolean) as [string, string][];
    const body = rows
        .map(
            ([k, v]) =>
                `<p style="margin:6px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`,
        )
        .join("");
    return wrap(`Riasztás · ${input.kind}`, body);
}

export function writeOutboxFile(payload: {
    to: string;
    subject: string;
    html: string;
    type: string;
}) {
    const dir = join(process.cwd(), "mail-outbox");
    mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}-${payload.type}-${payload.to.replace(/[^a-z0-9@._-]/gi, "_")}.html`;
    writeFileSync(
        join(dir, name),
        `To: ${payload.to}\nSubject: ${payload.subject}\n\n${payload.html}`,
        "utf8",
    );
    return name;
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
