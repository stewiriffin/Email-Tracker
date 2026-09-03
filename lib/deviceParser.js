const TABLET_RE = /ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/i;
const MOBILE_RE =
  /iphone|ipod|windows phone|blackberry|bb10|mobile|opera mini|iemobile|webos/i;

export function parseUserAgent(userAgent) {
  const ua = String(userAgent || "").trim();
  if (!ua || ua.toLowerCase() === "unknown") {
    return { device: "Desktop", clientType: "Unknown" };
  }

  return {
    device: detectDevice(ua),
    clientType: detectClient(ua),
  };
}

function detectDevice(ua) {
  if (TABLET_RE.test(ua)) return "Tablet";
  if (MOBILE_RE.test(ua)) return "Mobile";
  return "Desktop";
}

function detectClient(ua) {
  if (/googleimageproxy/i.test(ua) || /via ggpht\.com/i.test(ua)) {
    return "Gmail (GoogleImageProxy)";
  }
  if (/yahoomailproxy|ymail/i.test(ua)) return "Yahoo Mail Proxy";
  if (/barracuda|proofpoint|mimecast|messagelabs|fortimail/i.test(ua)) {
    return "Security scanner";
  }
  if (
    /outlook-ios|outlook-android|microsoft outlook|ms-office|microsoft office outlook/i.test(
      ua
    )
  ) {
    return "Outlook";
  }
  if (/thunderbird/i.test(ua)) return "Thunderbird";
  if (/superhuman/i.test(ua)) return "Superhuman";
  if (/airmail/i.test(ua)) return "Airmail";
  if (/sparkmail|readdle/i.test(ua)) return "Spark";
  if (/apple-mail/i.test(ua) || /macintosh.*\bmail\//i.test(ua)) {
    return "Apple Mail";
  }

  const lower = ua.toLowerCase();
  const isAppleWebKit = /applewebkit/i.test(ua);
  const isBrandedBrowser = /chrome|crios|fxios|firefox|edg\/|edgios|opr\//i.test(
    ua
  );

  if (isAppleWebKit && !isBrandedBrowser && /iphone|ipad|ipod|macintosh/.test(lower)) {
    if (/version\//i.test(ua) && /safari/i.test(ua)) return "Browser (Safari)";
    return "Apple Mail";
  }

  if (/edg\/|edgios/i.test(ua)) return "Browser (Edge)";
  if (/firefox|fxios/i.test(ua)) return "Browser (Firefox)";
  if (/chrome|crios/i.test(ua)) return "Browser (Chrome)";
  if (/safari/i.test(ua)) return "Browser (Safari)";

  return "Browser";
}
