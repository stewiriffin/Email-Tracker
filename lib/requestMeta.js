import { parseUserAgent } from "@/lib/deviceParser";

function headerValue(request, name) {
  return request.headers.get(name)?.trim() || "";
}

function decodeHeader(value) {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.trim();
  }
}

export function getClientIp(request) {
  const forwardedFor = headerValue(request, "x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  const vercelForwarded = headerValue(request, "x-vercel-forwarded-for");
  if (vercelForwarded) {
    const clientIp = vercelForwarded.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = headerValue(request, "x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export function getRequestContext(request) {
  const userAgent = headerValue(request, "user-agent") || "unknown";
  const { device, clientType } = parseUserAgent(userAgent);
  const city = decodeHeader(headerValue(request, "x-vercel-ip-city")) || "unknown";
  const country =
    headerValue(request, "x-vercel-ip-country").toUpperCase() || "unknown";

  return {
    ipAddress: getClientIp(request),
    userAgent,
    device,
    clientType,
    city,
    country,
  };
}
