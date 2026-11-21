// Pure helpers for the "Gmail" import tab — decoding a Gmail API message
// into plain text, building the search query, and tracking which emails
// were already reviewed. Kept free of DOM/network code so it can be
// tested in isolation (see gmailImport.test.js), same pattern as
// moneyMath.js: loaded as a <script type="module"> before main.js and
// exposed on `window` at the bottom.

export const GMAIL_DEFAULT_QUERY = "(from:esewa OR from:khalti) newer_than:30d";
export const GMAIL_MAX_SEEN = 2000;
const GMAIL_MAX_TEXT = 3000;

// Gmail returns body data as base64url (- and _ instead of + and /, no
// padding). atob() alone mangles non-ASCII, so decode to bytes first.
export function decodeBase64Url(data){
  if (!data) return "";
  let b64 = String(data).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  try{
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }catch(e){
    return "";
  }
}

export function stripHtml(html){
  return String(html || "")
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Walks a Gmail message payload (nested MIME parts) and returns the best
// plain text: text/plain if there is any, otherwise tag-stripped text/html.
export function extractMessageText(payload){
  const plain = [];
  const html = [];
  (function walk(part){
    if (!part) return;
    const mime = part.mimeType || "";
    const data = part.body && part.body.data;
    if (data && mime === "text/plain") plain.push(decodeBase64Url(data));
    else if (data && mime === "text/html") html.push(decodeBase64Url(data));
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  })(payload);
  const text = plain.length ? plain.join(" ").replace(/\s+/g, " ").trim() : stripHtml(html.join(" "));
  return text.slice(0, GMAIL_MAX_TEXT);
}

export function getHeader(payload, name){
  const headers = (payload && payload.headers) || [];
  const h = headers.find((x) => String(x.name).toLowerCase() === name.toLowerCase());
  return h ? String(h.value) : "";
}

// The text the SMS parser should read: the subject carries the account
// ("eSewa payment") and the body carries amount/vendor/balance.
export function buildEmailText(message){
  const payload = (message && message.payload) || {};
  const subject = getHeader(payload, "Subject");
  const body = extractMessageText(payload) || (message && message.snippet) || "";
  return (subject ? subject + ". " : "") + body;
}

// Local YYYY-MM-DD for a Gmail internalDate (ms since epoch, as a string).
export function emailDateStr(internalDate){
  const ms = Number(internalDate);
  if (!ms) return null;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Keeps the list of already-reviewed Gmail message IDs bounded, newest
// last, so localStorage can't grow forever.
export function addSeenIds(existing, newIds, max = GMAIL_MAX_SEEN){
  const merged = Array.from(new Set([...(existing || []), ...newIds]));
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

export function sanitizeQuery(q){
  const clean = String(q || "").replace(/\s+/g, " ").trim();
  return clean || GMAIL_DEFAULT_QUERY;
}

if (typeof window !== "undefined"){
  Object.assign(window, {
    GMAIL_DEFAULT_QUERY, decodeBase64Url, stripHtml, extractMessageText,
    getHeader, buildEmailText, emailDateStr, addSeenIds, sanitizeQuery,
  });
}
