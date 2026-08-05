"use client";
import { useLang, type DictKey } from "@/lib/i18n";
import { periodOptions } from "@/lib/calc";
import type { PeriodKind } from "@/lib/types";

const KINDS: { key: PeriodKind; label: DictKey }[] = [
  { key: "monthly", label: "monthly" },
  { key: "quarterly", label: "quarterly" },
  { key: "halfYearly", label: "halfYearly" },
  { key: "yearly", label: "yearly" },
];

export function PeriodFilter({
  kind, value, onKind, onValue,
}: {
  kind: PeriodKind;
  value: string;
  onKind: (k: PeriodKind) => void;
  onValue: (v: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("periodType")}>
      {KINDS.map((k) => (
        <button
          key={k.key}
          className="pill-btn"
          data-active={kind === k.key}
          onClick={() => {
            onKind(k.key);
            const opts = periodOptions(k.key);
            // keep the same year when switching kind
            const year = value.match(/\d{4}/)?.[0] ?? "2026";
            const next =
              k.key === "monthly" ? `Jun-${year}`
              : k.key === "quarterly" ? `Q2-${year}`
              : k.key === "halfYearly" ? `H1-${year}`
              : year;
            onValue(opts.includes(next) ? next : opts[0]);
          }}
        >
          {t(k.label)}
        </button>
      ))}
      <select
        className="select"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-label={t("period")}
      >
        {periodOptions(kind).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
