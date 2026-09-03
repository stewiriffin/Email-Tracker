const STORAGE_KEY = "backendUrl";
const LEGACY_STORAGE_KEY = "apiBaseUrl";

const apiUrlInput = document.getElementById("api-url");
const saveUrlButton = document.getElementById("save-url");
const saveMsg = document.getElementById("save-msg");
const configWarning = document.getElementById("config-warning");
const emailList = document.getElementById("email-list");
const listStatus = document.getElementById("list-status");
const refreshButton = document.getElementById("refresh");
const dashboardLink = document.getElementById("dashboard-link");

function stripTrailingSlashes(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeBaseUrl(value) {
  const trimmed = stripTrailingSlashes(value);
  if (!trimmed) return "";

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL, including http:// or https://");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Backend URL must start with http:// or https://");
  }

  return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, ""));
}

function originPattern(baseUrl) {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.host}/*`;
}

function formatSentAt(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "Unknown date";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setConfiguredState(baseUrl) {
  const configured = Boolean(baseUrl);
  configWarning.hidden = configured;
  dashboardLink.href = configured ? baseUrl : "#";
  dashboardLink.setAttribute("aria-disabled", configured ? "false" : "true");
  refreshButton.disabled = !configured;
}

function renderLoading() {
  listStatus.textContent = "Loading";
  emailList.innerHTML = `
    <div class="loading">
      <div class="spinner" aria-hidden="true"></div>
      Fetching latest tracked emails…
    </div>
  `;
}

function renderError(message) {
  listStatus.textContent = "Error";
  emailList.innerHTML = `<div class="error" role="alert">${escapeHtml(message)}</div>`;
}

function renderUnconfigured() {
  listStatus.textContent = "Setup required";
  emailList.innerHTML = `<div class="empty">Save your Vercel backend URL to load tracked emails.</div>`;
}

function renderEmails(emails) {
  if (!emails.length) {
    listStatus.textContent = "0";
    emailList.innerHTML = `<div class="empty">No tracked emails yet.</div>`;
    return;
  }

  listStatus.textContent = `${emails.length}`;
  emailList.innerHTML = emails
    .map((email) => {
      const opened = Number(email.openCount) > 0;
      return `
        <article class="item">
          <div class="item-top">
            <div class="subject" title="${escapeHtml(email.subject || "")}">${escapeHtml(email.subject || "(no subject)")}</div>
            <span class="badge ${opened ? "opened" : ""}">${opened ? "Opened" : "Unopened"}</span>
          </div>
          <div class="recipient">${escapeHtml(email.recipient || "")}</div>
          <div class="meta">${formatSentAt(email.sentAt)} · ${Number(email.openCount) || 0} open${Number(email.openCount) === 1 ? "" : "s"}</div>
        </article>
      `;
    })
    .join("");
}

async function getStoredBackendUrl() {
  const result = await chrome.storage.sync.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const url = stripTrailingSlashes(result[STORAGE_KEY] || result[LEGACY_STORAGE_KEY] || "");
  if (url && !result[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: url });
  }
  return url;
}

async function ensureHostPermission(baseUrl) {
  const origin = originPattern(baseUrl);
  const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
  if (alreadyGranted) return true;

  return chrome.permissions.request({ origins: [origin] });
}

async function fetchRecentEmails(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${baseUrl}/api/emails?limit=5`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Could not reach API (${response.status})`);
    }

    return Array.isArray(payload.emails) ? payload.emails : [];
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The tracking API timed out.");
    }
    throw new Error(error?.message || "Could not connect to the tracking API.");
  } finally {
    clearTimeout(timeout);
  }
}

async function loadEmails() {
  const storedUrl = await getStoredBackendUrl();
  const baseUrl = normalizeBaseUrl(apiUrlInput.value || storedUrl);
  setConfiguredState(baseUrl);

  if (!baseUrl) {
    renderUnconfigured();
    return;
  }

  renderLoading();
  refreshButton.disabled = true;

  try {
    const emails = await fetchRecentEmails(baseUrl);
    renderEmails(emails);
  } catch (error) {
    renderError(error.message || "Could not load tracked emails.");
  } finally {
    refreshButton.disabled = false;
  }
}

async function saveBackendUrl() {
  saveMsg.classList.remove("error");
  saveMsg.textContent = "";
  saveUrlButton.disabled = true;

  try {
    const baseUrl = normalizeBaseUrl(apiUrlInput.value);
    if (!baseUrl) {
      throw new Error("Backend URL is required.");
    }

    const granted = await ensureHostPermission(baseUrl);
    if (!granted) {
      throw new Error("Host permission is required to read stats from that URL.");
    }

    await chrome.storage.sync.set({ [STORAGE_KEY]: baseUrl });
    apiUrlInput.value = baseUrl;
    setConfiguredState(baseUrl);
    saveMsg.textContent = "Saved.";
    await loadEmails();
  } catch (error) {
    saveMsg.classList.add("error");
    saveMsg.textContent = error.message || "Could not save backend URL.";
  } finally {
    saveUrlButton.disabled = false;
  }
}

async function init() {
  chrome.runtime.sendMessage({ type: "CLEAR_BADGE" }).catch(() => {});

  const storedUrl = await getStoredBackendUrl();
  apiUrlInput.value = storedUrl;
  setConfiguredState(storedUrl);

  saveUrlButton.addEventListener("click", saveBackendUrl);
  refreshButton.addEventListener("click", loadEmails);
  apiUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveBackendUrl();
    }
  });
  dashboardLink.addEventListener("click", (event) => {
    event.preventDefault();
    if (!dashboardLink.href || dashboardLink.href.endsWith("#")) return;
    chrome.tabs.create({ url: dashboardLink.href });
  });

  await loadEmails();
}

init();
