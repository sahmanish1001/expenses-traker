// Scans every signed-in user's data (via the service role, same trust
// level as scripts/scrape-ipos.mjs's writes) for the same three
// conditions checkAlerts() in public/main.js shows as an on-app-open
// toast — over budget, a loan due soon, an IPO closing soon — and sends a
// real Web Push notification for each one to every device that opted in.
// Runs on a schedule via .github/workflows/send-push-notifications.yml.
//
// The actual "is this worth alerting about" logic lives in
// src/alertMath.js (unit-tested — see alertMath.test.js), shared with
// checkAlerts() in public/main.js, so a push and the in-app toast can
// never quietly disagree about what counts as "due soon" or "over budget".
import webpush from "web-push";
import { computeAllAlerts } from "../src/alertMath.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@example.com";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, or VAPID_PRIVATE_KEY env vars.");
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sbHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// The GitHub Actions runner's own local time is UTC, not Nepal's — using
// plain `new Date()` here would be exactly the same timezone bug fixed
// across public/main.js earlier (see fmtLocalDate() there), just moved
// server-side instead of client-side. This is the one "today" this whole
// script works from.
function todayInNepal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

// Returns true (and worth sending) only the first time this exact alert
// key is seen — a loan's key includes its current due date, so it
// naturally produces a fresh key (and re-notifies) once that date
// advances a cycle later, without any separate "how long since last
// sent" logic.
async function alreadyNotified(userId, alertKey) {
  const rows = await sbGet(`push_notification_log?user_id=eq.${userId}&alert_key=eq.${encodeURIComponent(alertKey)}&select=alert_key`);
  return rows.length > 0;
}

async function logNotified(userId, alertKey) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_notification_log`, {
    method: "POST",
    headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ user_id: userId, alert_key: alertKey }),
  });
}

async function deleteSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    headers: sbHeaders,
  });
}

async function sendToUser(userId, subs, payload) {
  for (const sub of subs) {
    const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (e) {
      // 404/410 = the browser/OS discarded this subscription (uninstalled,
      // permission revoked, etc.) — stop trying to send to it. Any other
      // error is transient/unexpected; leave the subscription alone and
      // just log it, rather than deleting something that might still work.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await deleteSubscription(sub.endpoint);
      } else {
        console.warn(`Push to user ${userId} failed (${e.statusCode || "?"}):`, e.body || e.message);
      }
    }
  }
}

async function main() {
  const today = todayInNepal();

  const [users, subsRows, sharedIpos] = await Promise.all([
    sbGet("user_data?select=id,data"),
    sbGet("push_subscriptions?select=*"),
    sbGet("ipos?select=*"),
  ]);

  const sharedIposMapped = sharedIpos.map((row) => ({
    id: row.id, company: row.company, closeDate: row.close_date, openDate: row.open_date, listed: false,
  }));

  const subsByUser = new Map();
  for (const sub of subsRows) {
    if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
    subsByUser.get(sub.user_id).push(sub);
  }

  let sent = 0;
  for (const row of users) {
    const subs = subsByUser.get(row.id);
    if (!subs || !subs.length) continue; // no device opted in — nothing to do
    const data = row.data || {};
    const alerts = computeAllAlerts(data, sharedIposMapped, today);

    for (const alert of alerts) {
      if (await alreadyNotified(row.id, alert.key)) continue;
      await sendToUser(row.id, subs, { title: `Kharchā — ${alert.title}`, body: alert.body, url: alert.url, tag: alert.key });
      await logNotified(row.id, alert.key);
      sent++;
    }
  }

  console.log(`Checked ${users.length} user(s), ${subsByUser.size} with an active subscription. Sent ${sent} new notification(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
