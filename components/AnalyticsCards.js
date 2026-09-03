"use client";

function formatPercent(value) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function DeviceBreakdown({ desktop, mobile }) {
  const total = desktop + mobile;
  const desktopPct = total > 0 ? (desktop / total) * 100 : 0;
  const mobilePct = total > 0 ? (mobile / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Desktop vs. Mobile opens
      </p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
          Device mix will appear after the first verified open.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            className="flex h-3 overflow-hidden rounded-full bg-stone-100"
            role="img"
            aria-label={`Desktop ${formatPercent(desktopPct)} percent, Mobile ${formatPercent(mobilePct)} percent`}
          >
            <div
              className="h-full bg-teal-800"
              style={{ width: `${desktopPct}%` }}
            />
            <div
              className="h-full bg-teal-400"
              style={{ width: `${mobilePct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-600">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-800" aria-hidden="true" />
              Desktop {desktop} ({formatPercent(Math.round(desktopPct * 10) / 10)}%)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-400" aria-hidden="true" />
              Mobile {mobile} ({formatPercent(Math.round(mobilePct * 10) / 10)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsCards({ analytics }) {
  const totalSent = analytics?.totalSent || 0;
  const totalOpens = analytics?.totalOpens || 0;
  const uniqueOpenRate = analytics?.uniqueOpenRate || 0;
  const clickThroughRate = analytics?.clickThroughRate || 0;
  const desktop = analytics?.deviceBreakdown?.desktop || 0;
  const mobile = analytics?.deviceBreakdown?.mobile || 0;

  return (
    <section className="mb-6 space-y-3" aria-label="Engagement overview">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Emails Sent" value={totalSent} />
        <MetricCard
          label="Unique Open Rate"
          value={`${formatPercent(uniqueOpenRate)}%`}
          hint="Emails opened at least once"
        />
        <MetricCard
          label="Total Opens"
          value={totalOpens}
          hint="Excludes automated / proxy scans"
        />
        <MetricCard
          label="Link Click-Through Rate"
          value={`${formatPercent(clickThroughRate)}%`}
          hint="Emails with at least one click"
        />
      </div>
      <DeviceBreakdown desktop={desktop} mobile={mobile} />
    </section>
  );
}
