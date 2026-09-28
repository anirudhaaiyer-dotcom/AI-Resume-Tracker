// Small presentational pieces shared by the pages.

const BAND_COLOR: Record<string, string> = {
  "Strong pattern match": "var(--strong)",
  "Partial match": "var(--partial)",
  "Spec match only": "var(--spec)",
  "No match": "var(--none)",
};

export function Band({ band }: { band?: string | null }) {
  if (!band) return <span className="text-xs text-muted">—</span>;
  const c = BAND_COLOR[band] ?? "var(--muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs"
      style={{ borderColor: c, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {band}
    </span>
  );
}

export const FLAG_LABEL: Record<string, string> = {
  pattern_floor: "No ops or fix-it evidence",
  spm_shipping_floor: "Thin product craft for SPM",
  consider_for_pm: "Consider for PM",
  experience_below_jd: "Below JD years (info only)",
  parse_failed: "CV unreadable",
};

export function Flags({ flags }: { flags?: string[] | null }) {
  if (!flags?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${
            f === "experience_below_jd" ? "border-line text-muted" : "border-partial text-partial"
          }`}
        >
          {FLAG_LABEL[f] ?? f}
        </span>
      ))}
    </span>
  );
}

export function Level({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`level ${level} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="h-2 w-4 rounded-sm" style={{ background: i <= level ? "var(--accent)" : "var(--line)" }} />
      ))}
    </span>
  );
}

const DECISION_LABEL: Record<string, string> = {
  advance: "Advanced",
  pass: "Passed",
  consider_for_pm: "Moved to PM",
};

export function Status({ decision, emailStatus }: { decision?: string | null; emailStatus?: string | null }) {
  if (!decision) return <span className="text-xs text-muted">Awaiting you</span>;
  const email =
    decision === "consider_for_pm"
      ? ""
      : emailStatus === "sent"
        ? " · email sent"
        : emailStatus === "failed"
          ? " · draft failed"
          : " · draft ready";
  return (
    <span className="text-xs">
      {DECISION_LABEL[decision] ?? decision}
      <span className="text-muted">{email}</span>
    </span>
  );
}
