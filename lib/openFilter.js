const APPLE_MPP_CIDRS = ["17.0.0.0/8"];

const BOT_UA_PATTERNS = [
  /googleimageproxy/i,
  /via ggpht\.com/i,
  /yahoomailproxy/i,
  /barracuda/i,
  /proofpoint/i,
  /mimecast/i,
  /messagelabs/i,
  /fortimail/i,
  /appleprivacycdn/i,
  /private-relay\.apple/i,
  /microsoft office existence discovery/i,
];

export function parseExcludeIps(value = process.env.EXCLUDE_IPS) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
}

export function isExcludedIp(ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip || ip === "unknown") return false;
  return parseExcludeIps().some((excluded) => normalizeIp(excluded) === ip);
}

export function detectBotOrProxy(request, { userAgent = "", ipAddress = "" } = {}) {
  const ua = String(userAgent || request?.headers?.get?.("user-agent") || "");
  if (BOT_UA_PATTERNS.some((pattern) => pattern.test(ua))) return true;

  const appleAction =
    request?.headers?.get?.("x-apple-action") ||
    request?.headers?.get?.("X-Apple-Action");
  if (appleAction) return true;

  const purpose =
    request?.headers?.get?.("purpose") ||
    request?.headers?.get?.("x-purpose") ||
    request?.headers?.get?.("sec-purpose");
  if (/prefetch|preview|previewgen/i.test(purpose || "")) return true;

  if (ipInCidrs(ipAddress, APPLE_MPP_CIDRS)) return true;

  return inferIsBotOrProxy({ userAgent: ua });
}

export function inferIsBotOrProxy({ userAgent = "", clientType = "", isBotOrProxy } = {}) {
  if (typeof isBotOrProxy === "boolean") return isBotOrProxy;
  const ua = String(userAgent || "");
  const client = String(clientType || "");
  if (BOT_UA_PATTERNS.some((pattern) => pattern.test(ua))) return true;
  if (/googleimageproxy|yahoo mail proxy|security scanner/i.test(client)) {
    return true;
  }
  return false;
}

function normalizeIp(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/, "");
}

function ipToLong(ip) {
  const parts = normalizeIp(ip).split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }
  return parts.reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function ipInCidrs(ip, cidrs) {
  const address = ipToLong(ip);
  if (address === null) return false;

  return cidrs.some((cidr) => {
    const [base, bitsRaw] = cidr.split("/");
    const baseLong = ipToLong(base);
    const bits = Number(bitsRaw);
    if (baseLong === null || !Number.isFinite(bits)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (address & mask) === (baseLong & mask);
  });
}
