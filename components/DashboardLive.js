"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsCards from "@/components/AnalyticsCards";
import ComposeModal from "@/components/ComposeModal";
import EmailTable from "@/components/EmailTable";

const EXCLUDE_AUTOMATED_KEY = "excludeAutomatedOpens";
const EMPTY_ANALYTICS = {
  totalSent: 0,
  totalOpens: 0,
  uniqueOpenRate: 0,
  clickThroughRate: 0,
  deviceBreakdown: { desktop: 0, mobile: 0 },
};

export default function DashboardLive({
  initialEmails,
  initialAnalytics,
  error,
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [analytics, setAnalytics] = useState(initialAnalytics || EMPTY_ANALYTICS);
  const [glowingId, setGlowingId] = useState(null);
  const [liveState, setLiveState] = useState("connecting");
  const [excludeAutomated, setExcludeAutomated] = useState(true);
  const excludeAutomatedRef = useRef(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(EXCLUDE_AUTOMATED_KEY);
    if (stored !== null) {
      const next = stored === "true";
      setExcludeAutomated(next);
      excludeAutomatedRef.current = next;
    }
  }, []);

  useEffect(() => {
    setEmails(initialEmails);
  }, [initialEmails]);

  useEffect(() => {
    setAnalytics(initialAnalytics || EMPTY_ANALYTICS);
  }, [initialAnalytics]);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    let glowTimer;

    source.onopen = () => setLiveState("live");

    source.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload?.type !== "open" || !payload.trackingId || !payload.open) {
        return;
      }

      setEmails((current) => {
        const target = current.find(
          (email) => email.trackingId === payload.trackingId
        );
        if (!target || target.opens.some((open) => open.id === payload.open.id)) {
          return current;
        }

        const shouldGlow = !(
          excludeAutomatedRef.current && payload.open.isBotOrProxy
        );
        if (shouldGlow) {
          setGlowingId(target.id);
          clearTimeout(glowTimer);
          glowTimer = setTimeout(() => setGlowingId(null), 1800);
        }

        return current.map((email) =>
          email.trackingId === payload.trackingId
            ? {
                ...email,
                openCount: email.openCount + 1,
                opens: [payload.open, ...email.opens],
              }
            : email
        );
      });

      refreshAnalytics();
    };

    source.onerror = () => setLiveState("reconnecting");

    return () => {
      clearTimeout(glowTimer);
      source.close();
    };
  }, []);

  const visibleEmails = useMemo(() => {
    if (!excludeAutomated) return emails;
    return emails.map((email) => {
      const opens = email.opens.filter((open) => !open.isBotOrProxy);
      return { ...email, opens, openCount: opens.length };
    });
  }, [emails, excludeAutomated]);

  async function refreshAnalytics() {
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      if (!response.ok) return;
      const summary = await response.json();
      if (summary && typeof summary.totalSent === "number") {
        setAnalytics(summary);
      }
    } catch {
      // Keep the last successful snapshot if a live refresh fails.
    }
  }

  function handleDeleted(id) {
    setEmails((current) => current.filter((email) => email.id !== id));
    refreshAnalytics();
  }

  function toggleExcludeAutomated() {
    setExcludeAutomated((current) => {
      const next = !current;
      excludeAutomatedRef.current = next;
      window.localStorage.setItem(EXCLUDE_AUTOMATED_KEY, String(next));
      return next;
    });
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-800">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            Email tracker
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Sent messages and their open activity, including timestamps, IP
            addresses, and user-agents for every tracked open.
          </p>
          <p className="mt-2 text-xs font-medium text-stone-500">
            {liveState === "live"
              ? "Live updates connected"
              : liveState === "reconnecting"
                ? "Reconnecting live updates…"
                : "Connecting live updates…"}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <a
              href="/api/export"
              className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50"
            >
              Export CSV
            </a>
            <ComposeModal />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={excludeAutomated}
              onChange={toggleExcludeAutomated}
              className="h-4 w-4 accent-teal-800"
            />
            Exclude Automated / Proxy Opens
          </label>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <AnalyticsCards analytics={analytics} />

      <EmailTable
        emails={visibleEmails}
        glowingId={glowingId}
        onDeleted={handleDeleted}
      />
    </main>
  );
}
