"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

const INITIAL_FORM = {
  recipient: "",
  subject: "",
  body: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ComposeModal() {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !sending) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, sending]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function closeModal() {
    if (sending) return;
    setOpen(false);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const recipient = form.recipient.trim();
    const subject = form.subject.trim();
    const body = form.body.trim();

    if (!EMAIL_PATTERN.test(recipient)) {
      setFormError("Enter a valid recipient email address.");
      return;
    }
    if (!subject) {
      setFormError("Subject cannot be empty.");
      return;
    }
    if (!body) {
      setFormError("Body cannot be empty.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, subject, body }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to send email");
      }

      setForm(INITIAL_FORM);
      setOpen(false);
      setNotice({
        type: "success",
        message: `Email sent to ${payload.email?.recipient || recipient}`,
      });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email";
      setFormError(message);
      setNotice({ type: "error", message });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormError("");
          setOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
      >
        Compose Email
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close compose dialog"
            className="absolute inset-0 bg-stone-950/45"
            onClick={closeModal}
            disabled={sending}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-stone-900">
                  Compose Email
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  The message will be sent over Gmail SMTP with a tracking pixel
                  attached.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={sending}
                className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">
                  Recipient Email
                </span>
                <input
                  type="email"
                  name="recipient"
                  required
                  autoComplete="email"
                  autoFocus
                  value={form.recipient}
                  onChange={updateField}
                  disabled={sending}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-teal-700/30 transition focus:border-teal-700 focus:ring-2 disabled:bg-stone-50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">
                  Subject
                </span>
                <input
                  type="text"
                  name="subject"
                  required
                  value={form.subject}
                  onChange={updateField}
                  disabled={sending}
                  placeholder="Message subject"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-teal-700/30 transition focus:border-teal-700 focus:ring-2 disabled:bg-stone-50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">
                  Body
                </span>
                <textarea
                  name="body"
                  required
                  rows={8}
                  value={form.body}
                  onChange={updateField}
                  disabled={sending}
                  placeholder="Write your message. Basic HTML is supported."
                  className="w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-teal-700/30 transition focus:border-teal-700 focus:ring-2 disabled:bg-stone-50"
                />
              </label>

              {formError ? (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={sending}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-800/70"
                >
                  {sending ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden="true"
                      />
                      Sending
                    </>
                  ) : (
                    "Send email"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
            notice.type === "success"
              ? "border-teal-200 bg-white text-teal-900"
              : "border-red-200 bg-white text-red-800"
          }`}
        >
          {notice.message}
        </div>
      ) : null}
    </>
  );
}
