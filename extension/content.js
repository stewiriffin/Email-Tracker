(() => {
  const TRACK_PREF_KEY = "trackByDefault";
  const BOUND_ATTR = "data-email-tracker-bound";
  const PIXEL_ATTR = "data-email-tracker-pixel";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const state = {
    trackByDefault: true,
  };

  chrome.storage.sync.get({ [TRACK_PREF_KEY]: true }, (result) => {
    state.trackByDefault = result[TRACK_PREF_KEY] !== false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[TRACK_PREF_KEY]) {
      state.trackByDefault = changes[TRACK_PREF_KEY].newValue !== false;
    }
  });

  function qs(root, selector) {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }

  function qsa(root, selector) {
    try {
      return [...root.querySelectorAll(selector)];
    } catch {
      return [];
    }
  }

  function findSendButton(compose) {
    const buttons = qsa(compose, '[role="button"]');
    for (const button of buttons) {
      if (button.classList.contains("aoO")) return button;
      const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-tooltip") || ""}`.trim();
      if (/^Send\b/i.test(label) && !/feedback|invite/i.test(label)) {
        return button;
      }
    }
    return null;
  }

  function findBodyEl(compose) {
    return (
      qs(compose, 'div[aria-label="Message Body"][contenteditable="true"]') ||
      qs(compose, 'div[g_editable="true"][contenteditable="true"]') ||
      qs(compose, "div.Am.Al.editable") ||
      qs(compose, 'div[aria-label="Message Body"]') ||
      qs(compose, 'div[role="textbox"][contenteditable="true"]')
    );
  }

  function findSubjectEl(compose) {
    return qs(compose, 'input[name="subjectbox"]');
  }

  function isComposeContainer(el) {
    if (!(el instanceof Element)) return false;
    return Boolean(findSendButton(el) && findBodyEl(el));
  }

  function findComposeWindows() {
    const nodes = [
      ...qsa(document, ".M9"),
      ...qsa(document, '[role="dialog"]'),
    ];
    const unique = [...new Set(nodes)];
    return unique.filter(isComposeContainer);
  }

  function extractRecipient(compose) {
    const scopes = [
      ...qsa(compose, ".aoD"),
      ...qsa(compose, '[aria-label="To recipients"]'),
      ...qsa(compose, '[aria-label^="To"]'),
    ];
    const roots = scopes.length ? scopes : [compose];

    for (const root of roots) {
      for (const el of qsa(root, "[email]")) {
        const value = (el.getAttribute("email") || "").trim().toLowerCase();
        if (EMAIL_RE.test(value)) return value;
      }
      for (const el of qsa(root, "[data-hovercard-id]")) {
        const value = (el.getAttribute("data-hovercard-id") || "").trim().toLowerCase();
        if (EMAIL_RE.test(value)) return value;
      }
    }

    const toField = qs(compose, 'textarea[name="to"]') || qs(compose, 'input[name="to"]');
    const typed = (toField?.value || "").trim().toLowerCase();
    const match = typed.match(EMAIL_RE);
    return match ? match[0] : "";
  }

  function readCompose(compose) {
    const subjectEl = findSubjectEl(compose);
    const bodyEl = findBodyEl(compose);
    return {
      recipient: extractRecipient(compose),
      subject: (subjectEl?.value || "").trim(),
      body: bodyEl?.innerHTML || "",
      bodyEl,
    };
  }

  function hasTrackingPixel(bodyEl) {
    if (!bodyEl) return false;
    return Boolean(
      bodyEl.querySelector(`img[${PIXEL_ATTR}]`) ||
        bodyEl.querySelector('img[src*="/api/track/"]')
    );
  }

  function appendPixel(bodyEl, pixelUrl) {
    if (!bodyEl || hasTrackingPixel(bodyEl)) return;
    const img = bodyEl.ownerDocument.createElement("img");
    img.src = pixelUrl;
    img.width = 1;
    img.height = 1;
    img.alt = "";
    img.setAttribute("style", "display:none;");
    img.setAttribute(PIXEL_ATTR, "true");
    bodyEl.appendChild(img);
  }

  function isToggleOn(compose) {
    const host = qs(compose, ".email-tracker-host");
    const checkbox = host?.shadowRoot?.querySelector("input[type='checkbox']");
    return checkbox ? checkbox.checked : state.trackByDefault;
  }

  function registerTracking(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: "REGISTER_TRACKING", payload },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!response?.ok) {
              reject(new Error(response?.error || "Failed to register tracking id"));
              return;
            }
            resolve(response);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  function clickSend(compose) {
    const sendButton = findSendButton(compose);
    if (!sendButton) return;
    compose.__emailTrackerBypass = true;
    try {
      sendButton.click();
    } finally {
      queueMicrotask(() => {
        compose.__emailTrackerBypass = false;
      });
    }
  }

  async function prepareTrackedSend(compose) {
    if (compose.__emailTrackerBusy) return;
    compose.__emailTrackerBusy = true;

    try {
      if (isToggleOn(compose)) {
        const draft = readCompose(compose);
        if (draft.bodyEl && !hasTrackingPixel(draft.bodyEl) && EMAIL_RE.test(draft.recipient)) {
          const result = await registerTracking({
            recipient: draft.recipient,
            subject: draft.subject,
            body: draft.body,
          });
          appendPixel(
            draft.bodyEl,
            result.pixelUrl ||
              `${result.apiUrl}/api/track/${result.trackingId}.png`
          );
        }
      }
    } catch (error) {
      console.warn("[Email Tracker] Continuing send without pixel:", error);
    } finally {
      clickSend(compose);
      setTimeout(() => {
        compose.__emailTrackerBusy = false;
      }, 250);
    }
  }

  function isSendShortcut(event) {
    if (event.key !== "Enter" && event.code !== "Enter") return false;
    if (event.shiftKey || event.altKey) return false;
    return Boolean(event.ctrlKey || event.metaKey);
  }

  function isFromSendButton(event, sendButton) {
    if (!sendButton) return false;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    return path.includes(sendButton) || sendButton.contains(event.target);
  }

  function injectToggle(compose, sendButton) {
    if (qs(compose, ".email-tracker-host")) return;

    const host = document.createElement("div");
    host.className = "email-tracker-host";
    host.style.cssText =
      "display:inline-flex;align-items:center;margin-left:8px;flex:0 0 auto;vertical-align:middle;";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { font-family: Roboto, Arial, sans-serif; }
        label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          color: #3c4043;
          font-size: 12.5px;
          line-height: 20px;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        input {
          margin: 0;
          width: 14px;
          height: 14px;
          accent-color: #0b57d0;
        }
      </style>
      <label>
        <input type="checkbox" />
        Track Email
      </label>
    `;

    const checkbox = shadow.querySelector("input");
    checkbox.checked = state.trackByDefault;
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("mousedown", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      chrome.storage.sync.set({ [TRACK_PREF_KEY]: checkbox.checked });
    });

    const sendGroup = sendButton.closest(".gU.Up") || sendButton.parentElement;
    const toolbar = sendButton.closest(".btC");
    if (sendGroup?.parentElement) {
      sendGroup.insertAdjacentElement("afterend", host);
    } else if (toolbar) {
      toolbar.appendChild(host);
    } else {
      sendButton.insertAdjacentElement("afterend", host);
    }
  }

  function bindCompose(compose) {
    const sendButton = findSendButton(compose);
    if (!sendButton) return;

    injectToggle(compose, sendButton);
    if (compose.getAttribute(BOUND_ATTR) === "true") return;
    compose.setAttribute(BOUND_ATTR, "true");

    compose.addEventListener(
      "click",
      (event) => {
        if (compose.__emailTrackerBypass || compose.__emailTrackerBusy) return;
        if (!isToggleOn(compose)) return;
        if (!isFromSendButton(event, findSendButton(compose))) return;
        if (hasTrackingPixel(findBodyEl(compose))) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        prepareTrackedSend(compose);
      },
      true
    );

    compose.addEventListener(
      "keydown",
      (event) => {
        if (!isSendShortcut(event)) return;
        if (compose.__emailTrackerBypass || compose.__emailTrackerBusy) return;
        if (!isToggleOn(compose)) return;
        if (hasTrackingPixel(findBodyEl(compose))) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        prepareTrackedSend(compose);
      },
      true
    );
  }

  function scan() {
    try {
      findComposeWindows().forEach(bindCompose);
    } catch (error) {
      console.warn("[Email Tracker] Compose scan skipped:", error);
    }
  }

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan();
    });
  }

  const observer = new MutationObserver(queueScan);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        observer.observe(document.body, { childList: true, subtree: true });
        scan();
      },
      { once: true }
    );
  }
})();
