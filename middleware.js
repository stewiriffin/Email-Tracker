import { NextResponse } from "next/server";

const TRACKING_PREFIXES = ["/api/track", "/api/click"];
const RATE_WINDOW_MS = 60_000;
const DEFAULT_API_LIMIT = 60;
const ROUTE_LIMITS = {
  "POST /api/send": 10,
  "POST /api/emails": 30,
  "GET /api/emails": 120,
  "GET /api/emails/recent": 120,
};

const buckets = globalThis.__emailTrackerRateBuckets || new Map();
globalThis.__emailTrackerRateBuckets = buckets;

function isPublicAsset(pathname) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  );
}

function isDashboardPath(pathname) {
  return pathname === "/" || pathname === "" || pathname === "/api/stream";
}

function isTrackingPath(pathname) {
  return TRACKING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < length; i += 1) {
    mismatch |= (a[i] || 0) ^ (b[i] || 0);
  }

  return mismatch === 0;
}

function parseBasicCredentials(header) {
  if (!header || !header.startsWith("Basic ")) return null;

  try {
    const decoded = atob(header.slice(6).trim());
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function isAuthorizedAdmin(request) {
  const expectedUser = process.env.ADMIN_USERNAME || "";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedUser || !expectedPass) return false;

  const credentials = parseBasicCredentials(request.headers.get("authorization"));
  if (!credentials) return false;

  return (
    timingSafeEqual(credentials.username, expectedUser) &&
    timingSafeEqual(credentials.password, expectedPass)
  );
}

function unauthorizedDashboard() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin Dashboard", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return String(value || "").replace(/\/+$/, "");
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("moz-extension://")) return true;

  const configured = process.env.NEXT_PUBLIC_BASE_URL;
  const allowed = new Set(
    [
      configured,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
      .filter(Boolean)
      .map(normalizeOrigin)
  );

  return allowed.has(origin);
}

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function allowRequest(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/") || isTrackingPath(pathname) || pathname === "/api/stream") {
    return true;
  }

  const keyBase = `${request.method} ${pathname.replace(/\/$/, "") || "/"}`;
  const limit = ROUTE_LIMITS[keyBase] || DEFAULT_API_LIMIT;
  const key = `${clientIp(request)}:${keyBase}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.windowStart >= RATE_WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return true;
  }

  current.count += 1;
  if (buckets.size > 5000) {
    for (const [entryKey, entry] of buckets) {
      if (now - entry.windowStart >= RATE_WINDOW_MS) buckets.delete(entryKey);
    }
  }

  return current.count <= limit;
}

function applySecurityHeaders(response, request) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set("X-DNS-Prefetch-Control", "off");

  const proto =
    request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  if (proto === "https") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  if (isTrackingPath(request.nextUrl.pathname)) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
  }

  return response;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || isTrackingPath(pathname)) {
    if (request.method === "OPTIONS") {
      return applySecurityHeaders(new NextResponse(null, { status: 204 }), request);
    }
    return applySecurityHeaders(NextResponse.next(), request);
  }

  if (isDashboardPath(pathname) && !isAuthorizedAdmin(request)) {
    return applySecurityHeaders(unauthorizedDashboard(), request);
  }

  if (request.method === "OPTIONS") {
    return applySecurityHeaders(new NextResponse(null, { status: 204 }), request);
  }

  if (!allowRequest(request)) {
    const response = NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 }
    );
    response.headers.set("Retry-After", "60");
    return applySecurityHeaders(response, request);
  }

  return applySecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
