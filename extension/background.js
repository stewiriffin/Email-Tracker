const DEFAULT_API_URL = "http://localhost:3000";
const STORAGE_KEY = "apiBaseUrl";
const ALARM_NAME = "poll-recent-emails";
const POLL_MINUTES = 1.5;
const SNAPSHOT_KEY = "openSnapshot";
const UNREAD_KEY = "unreadOpenCount";
const BADGE_COLOR = "#10B981";

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  pollRecentOpens();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  pollRecentOpens();
});

ensureAlarm();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollRecentOpens();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CLEAR_BADGE") {
    clearBadge()
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to clear badge",
        })
      );
    return true;
  }

  if (message?.type === "REGISTER_TRACKING") {
    registerTracking(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to register tracking id",
        })
      );
    return true;
  }

  return undefined;
});

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing) return;

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: POLL_MINUTES,
  });
}

async function getApiUrl() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return String(stored[STORAGE_KEY] || DEFAULT_API_URL).replace(/\/+$/, "");
}

async function pollRecentOpens() {
  try {
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/api/emails/recent`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Tracking API returned ${response.status}`);
    }

    const emails = Array.isArray(payload.emails) ? payload.emails : [];
    await applyOpenSnapshot(emails);
  } catch (error) {
    console.warn("[Email Tracker] Poll failed:", error);
  }
}

async function applyOpenSnapshot(emails) {
  const local = await chrome.storage.local.get([SNAPSHOT_KEY, UNREAD_KEY]);
  const previous = local[SNAPSHOT_KEY] && typeof local[SNAPSHOT_KEY] === "object"
    ? local[SNAPSHOT_KEY]
    : null;
  const unread = Number(local[UNREAD_KEY]) || 0;

  const nextSnapshot = {};
  let newOpens = 0;

  for (const email of emails) {
    const trackingId = email.trackingId;
    if (!trackingId) continue;

    const openCount = Number(email.openCount) || 0;
    const latestOpenedAt = email.latestOpenedAt || null;
    nextSnapshot[trackingId] = { openCount, latestOpenedAt };

    if (!previous) continue;

    const prior = previous[trackingId];
    if (!prior) {
      newOpens += openCount;
      continue;
    }

    const countDelta = Math.max(0, openCount - (Number(prior.openCount) || 0));
    const newerTimestamp =
      Boolean(latestOpenedAt) &&
      latestOpenedAt !== prior.latestOpenedAt &&
      (!prior.latestOpenedAt ||
        new Date(latestOpenedAt).getTime() > new Date(prior.latestOpenedAt).getTime());

    newOpens += countDelta;
    if (countDelta === 0 && newerTimestamp && openCount > 0) {
      newOpens += 1;
    }
  }

  const nextUnread = previous ? unread + newOpens : unread;
  await chrome.storage.local.set({
    [SNAPSHOT_KEY]: nextSnapshot,
    [UNREAD_KEY]: nextUnread,
  });

  if (previous) {
    await setBadge(nextUnread);
  } else {
    await setBadge(unread);
  }
}

async function setBadge(count) {
  const value = Math.max(0, Number(count) || 0);
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await chrome.action.setBadgeText({
    text: value > 0 ? (value > 99 ? "99+" : String(value)) : "",
  });
}

async function clearBadge() {
  await chrome.storage.local.set({ [UNREAD_KEY]: 0 });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await chrome.action.setBadgeText({ text: "" });
}

async function registerTracking(payload = {}) {
  const apiUrl = await getApiUrl();

  const response = await fetch(`${apiUrl}/api/emails`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: payload.recipient,
      subject: payload.subject,
      body: payload.body,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Tracking API returned ${response.status}`);
  }

  const trackingId = data.email?.trackingId;
  if (!trackingId) {
    throw new Error("Tracking API did not return a trackingId");
  }

  return {
    ok: true,
    apiUrl,
    trackingId,
    pixelUrl: `${apiUrl}/api/track/${trackingId}.png`,
  };
}
