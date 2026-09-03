"use client";

import { useEffect, useMemo, useState } from "react";
import ComposeModal from "@/components/ComposeModal";
import EmailTable from "@/components/EmailTable";

export default function DashboardLive({ initialEmails, error }) {
  const [emails, setEmails] = useState(initialEmails);
  const [glowingId, setGlowingId] = useState(null);
  const [liveState, setLiveState] = useState("connecting");

  useEffect(() => {
    setEmails(initialEmails);
  }, [initialEmails]);

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

        setGlowingId(target.id);
        clearTimeout(glowTimer);
        glowTimer = setTimeout(() => setGlowingId(null), 1800);

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
    };

    source.onerror = () => setLiveState("reconnecting");

    return () => {
      clearTimeout(glowTimer);
      source.close();
    };
  }, []);

  const openedCount = useMemo(
    () => emails.filter((email) => email.openCount > 0).length,
    [emails]
  );
  const unopenedCount = emails.length - openedCount;

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
        <ComposeModal />
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {emails.length > 0 ? (
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Sent" value={emails.length} />
          <StatCard label="Opened" value={openedCount} />
          <StatCard label="Unopened" value={unopenedCount} />
        </section>
      ) : null}

      <EmailTable emails={emails} glowingId={glowingId} />
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
    </div>
  );
}
