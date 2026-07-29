/** A single KPI tile for the command center (score, cited checks, open issues). */
export function ScoreCard({
  label, value, delta, deltaLabel = "vs last scan",
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  deltaLabel?: string;
}) {
  const hasDelta = delta !== undefined && delta !== null && delta !== 0;
  const deltaText = hasDelta ? `${delta! > 0 ? "+" : ""}${delta} ${deltaLabel}` : null;
  const deltaColor = !hasDelta
    ? ""
    : delta! > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">{value}</p>
      {deltaText && <p className={`mt-1 text-xs font-medium ${deltaColor}`}>{deltaText}</p>}
    </div>
  );
}
