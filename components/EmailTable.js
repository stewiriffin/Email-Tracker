"use client";

import { useState } from "react";

function formatSentDate(iso) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatOpenTime(iso) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(iso));
}

export default function EmailTable({ emails }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!emails.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/70 px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-stone-900">No emails sent yet</h2>
        <p className="mt-1 max-w-sm text-sm text-stone-500">
          When you send a tracked email, it will show up here with open status and
          event details.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-3.5">Recipient</th>
              <th className="px-5 py-3.5">Subject</th>
              <th className="px-5 py-3.5">Sent Date</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Open Count</th>
              <th className="px-5 py-3.5">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {emails.map((email) => {
              const isOpened = email.openCount > 0;
              const isExpanded = expandedId === email.id;

              return (
                <EmailRow
                  key={email.id}
                  email={email}
                  isOpened={isOpened}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedId(isExpanded ? null : email.id)
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailRow({ email, isOpened, isExpanded, onToggle }) {
  return (
    <>
      <tr className={isExpanded ? "bg-teal-50/40" : "bg-white hover:bg-stone-50"}>
        <td className="whitespace-nowrap px-5 py-4 font-medium text-stone-900">
          {email.recipient}
        </td>
        <td className="max-w-xs truncate px-5 py-4 text-stone-700" title={email.subject}>
          {email.subject}
        </td>
        <td className="whitespace-nowrap px-5 py-4 text-stone-600">
          {formatSentDate(email.sentAt)}
        </td>
        <td className="px-5 py-4">
          {isOpened ? (
            <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
              Opened
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
              Unopened
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-stone-800">
          {email.openCount}
        </td>
        <td className="px-5 py-4 text-right">
          {isOpened ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
            >
              {isExpanded ? "Hide details" : "View details"}
            </button>
          ) : (
            <span className="text-xs text-stone-400">—</span>
          )}
        </td>
      </tr>
      {isOpened && isExpanded ? (
        <tr className="bg-stone-50">
          <td colSpan={6} className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Open events
            </p>
            <ul className="space-y-3">
              {email.opens.map((open) => (
                <li
                  key={open.id}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-3"
                >
                  <dl className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:gap-x-6">
                    <dt className="text-xs font-medium text-stone-500">Timestamp</dt>
                    <dd className="text-sm text-stone-900">
                      {formatOpenTime(open.openedAt)}
                    </dd>
                    <dt className="text-xs font-medium text-stone-500">IP address</dt>
                    <dd className="font-mono text-sm text-stone-900">
                      {open.ipAddress}
                    </dd>
                    <dt className="text-xs font-medium text-stone-500">User-Agent</dt>
                    <dd className="break-all text-sm text-stone-700">
                      {open.userAgent}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}
