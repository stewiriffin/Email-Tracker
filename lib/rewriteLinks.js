const SKIP_SCHEMES = /^(mailto:|tel:|sms:|javascript:|data:|cid:)/i;
const ANCHOR_ONLY = /^#/;
const UNSUBSCRIBE_RE = /unsubscribe/i;
const TRACKED_CLICK_RE = /\/api\/click\//i;
const A_HREF_RE =
  /<a\b([^>]*?)\bhref\s*=\s*(["'])([\s\S]*?)\2([^>]*)>/gi;

export function decodeHref(value) {
  const raw = String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();

  try {
    return decodeURI(raw);
  } catch {
    return raw;
  }
}

export function parseSafeHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return null;

  let candidate = raw.trim();
  if (!candidate || candidate.length > 2048) return null;

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Use the original string when it is not percent-encoded.
  }

  candidate = candidate.replace(/[\u0000-\u001F\u007F]/g, "").trim();

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (!parsed.hostname) {
    return null;
  }

  return parsed.toString();
}

export function shouldRewriteHref(href) {
  const value = decodeHref(href);
  if (!value) return false;
  if (ANCHOR_ONLY.test(value)) return false;
  if (SKIP_SCHEMES.test(value)) return false;
  if (UNSUBSCRIBE_RE.test(value)) return false;
  if (TRACKED_CLICK_RE.test(value)) return false;
  return Boolean(parseSafeHttpUrl(value));
}

export function rewriteTrackedLinks(html, { baseUrl, trackingId }) {
  if (!html || !trackingId) return html || "";

  const origin = String(baseUrl || "").replace(/\/+$/, "");
  if (!origin) return html;

  return html.replace(A_HREF_RE, (full, pre, quote, href, post) => {
    if (!shouldRewriteHref(href)) return full;

    const destination = parseSafeHttpUrl(decodeHref(href));
    if (!destination) return full;

    const tracked = `${origin}/api/click/${encodeURIComponent(trackingId)}?url=${encodeURIComponent(destination)}`;
    return `<a${pre}href=${quote}${tracked}${quote}${post}>`;
  });
}

export function prepareTrackedHtml(htmlBody, { baseUrl, trackingId }) {
  const rewritten = rewriteTrackedLinks(htmlBody, { baseUrl, trackingId });
  const pixelUrl = `${String(baseUrl).replace(/\/+$/, "")}/api/track/${encodeURIComponent(trackingId)}.png`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  return `${rewritten}${pixelTag}`;
}
