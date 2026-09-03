function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function toAbsoluteUrl(value) {
  const trimmed = stripTrailingSlash(value);
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getBaseUrl() {
  const explicit = stripTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL);
  if (explicit) return explicit;

  const production = toAbsoluteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return production;

  const preview = toAbsoluteUrl(process.env.VERCEL_URL);
  if (preview) return preview;

  return "http://localhost:3000";
}
