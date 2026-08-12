"use client";
import { useLang, type DictKey } from "@/lib/i18n";
import { parsePeriod, periodContaining, periodOptions } from "@/lib/calc";
import type { PeriodKind } from "@/lib/types";

const KINDS: { key: PeriodKind; label: DictKey }[] = [
  { key: "monthly", label: "monthly" },
  { key: "quarterly", label: "quarterly" },
  { key: "halfYearly", label: "halfYearly" },
  { key: "yearly", label: "yearly" },
];

/**
 * `months` are the month indices that actually carry data for whatever is on
 * screen — the selected company, the departments, the team. Only periods
 * overlapping one of them are offered, so the dropdown can never lead to an
 * empty dashboard.
 */
export function PeriodFilter({
  kind, value, onKind, onValue, months,
}: {
  kind: PeriodKind;
  value: string;
  onKind: (k: PeriodKind) => void;
  onValue: (v: string) => void;
  months: number[];
}) {
  const { t } = useLang();
  const opts = periodOptions(kind, months);
  const cur = parsePeriod(kind, value);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("periodType")}>
      {KINDS.map((k) => (
        <button
          key={k.key}
          className="pill-btn"
          data-active={kind === k.key}
          onClick={() => {
            // land on the period covering the same point in time, so switching
            // granularity never jumps the reader to a different part of the year
            const next = periodOptions(k.key, months);
            const target = cur ? periodContaining(k.key, cur.start, next) : undefined;
            onKind(k.key);
            onValue(target ?? next.at(-1) ?? "");
          }}
        >
          {t(k.label)}
        </button>
      ))}
      <select
        className="select"
        value={opts.includes(value) ? value : ""}
        onChange={(e) => onValue(e.target.value)}
        aria-label={t("period")}
        disabled={opts.length === 0}
      >
        {opts.length === 0 && <option value="">—</option>}
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
