"use client";
import { useMemo, useState } from "react";
import { useLang, type DictKey } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import { deptAgg, fmt, growthChange, parsePeriod, previousLabel, type DeptAgg } from "@/lib/calc";
import type { PeriodKind } from "@/lib/types";
import { PeriodFilter } from "@/components/period-filter";
import { ChangeBadge, ChangeValue, KpiCard, SectionTitle } from "@/components/ui";
import { GroupedCompare, PeriodLegend } from "@/components/charts";

const DEPTS: { key: string; label: DictKey; hasDays: boolean }[] = [
  { key: "Totals", label: "deptTotals", hasDays: false },
  { key: "Sales Services", label: "deptSales", hasDays: true },
  { key: "Marketing", label: "deptMarketing", hasDays: false },
];

function GrowthRow({ label, value, badge, indent = false }: {
  label: string; value: React.ReactNode; badge: React.ReactNode; indent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 px-5 py-3 ${indent ? "bg-[rgba(4,203,121,.03)]" : ""}`}>
      <span className={`text-sm ${indent ? "ps-5 font-semibold text-ink2" : "font-bold text-ink"}`}>{label}</span>
      <span className="flex items-center gap-3">{value}{badge}</span>
    </div>
  );
}

export default function PerformancePage() {
  const { t } = useLang();
  const { data, loading } = useData();
  const [kind, setKind] = useState<PeriodKind>("monthly");
  const [value, setValue] = useState("Jun-2026");

  const model = useMemo(() => {
    if (!data) return null;
    const w = parsePeriod(kind, value);
    if (!w) return null;
    const pw = { start: w.start - w.span, span: w.span };
    const agg: Record<string, { cur: DeptAgg; prev: DeptAgg }> = {};
    for (const d of DEPTS) {
      agg[d.key] = {
        cur: deptAgg(data.departmentsMonthly, d.key, w),
        prev: deptAgg(data.departmentsMonthly, d.key, pw),
      };
    }
    return { w, agg, prevLabel: previousLabel(kind, w) };
  }, [data, kind, value]);

  if (loading && !data) return <p className="py-20 text-center text-ink2">{t("loading")}</p>;
  if (!data || !model) return null;

  const totals = model.agg["Totals"];

  return (
    <div>
      <header className="fade-up mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">{t("perfTitle")}</h1>
          <p className="mt-1 text-sm text-ink3">{value}</p>
        </div>
        <PeriodFilter kind={kind} value={value} onKind={setKind} onValue={setValue} />
      </header>

      {/* growth comparison — small multiples: counts + MRR (no dual axis) */}
      <SectionTitle>{`${t("growthComparison")} — ${value} ↔ ${model.prevLabel}`}</SectionTitle>
      <div className="card p-5">
        <PeriodLegend curLabel={value} prevLabel={model.prevLabel} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-bold text-ink2">{t("counts")}</p>
            <GroupedCompare
              curLabel={value}
              prevLabel={model.prevLabel}
              data={[
                { label: t("activeProjects"), cur: totals.cur.active ?? 0, prev: totals.prev.active },
                { label: t("newProjects"), cur: totals.cur.newP ?? 0, prev: totals.prev.newP },
                { label: t("endedProjects"), cur: totals.cur.ended ?? 0, prev: totals.prev.ended },
              ]}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-ink2">{t("mrr")}</p>
            <GroupedCompare
              curLabel={value}
              prevLabel={model.prevLabel}
              data={[{ label: t("mrr"), cur: totals.cur.mrr ?? 0, prev: totals.prev.mrr }]}
            />
          </div>
        </div>
      </div>

      {/* department sections */}
      {DEPTS.map((d) => {
        const { cur, prev } = model.agg[d.key];
        return (
          <section key={d.key}>
            <SectionTitle>{t(d.label)}</SectionTitle>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard delay="d1" label={t("activeProjects")} value={fmt(cur.active ?? 0)} />
              <KpiCard delay="d2" label={t("newProjects")} value={fmt(cur.newP ?? 0)} />
              <KpiCard delay="d3" label={t("endedProjects")} value={fmt(cur.ended ?? 0)} />
              <KpiCard delay="d4" label={t("mrr")} value={`${fmt(cur.mrr ?? 0)} ${t("sar")}`} />
            </div>
            <div className="card mt-4 divide-y divide-[var(--line)] overflow-hidden">
              <GrowthRow label={t("rTotalActive")}
                value={<ChangeValue value={growthChange(cur.active, prev.active).change} />}
                badge={<ChangeBadge cls={growthChange(cur.active, prev.active).cls} />} />
              <GrowthRow label={t("rNew")}
                value={<ChangeValue value={growthChange(cur.newP, prev.newP).change} />}
                badge={<ChangeBadge cls={growthChange(cur.newP, prev.newP).cls} />} />
              <GrowthRow label={t("rStopped")}
                value={<span className="text-sm font-bold tabular-nums text-brand-dark" dir="ltr">
                  {cur.ended == null ? "—" : fmt(cur.ended)} ({t("was")} {prev.ended == null ? "—" : fmt(prev.ended)})
                </span>}
                badge={<span className="chip bg-[rgba(148,163,184,.14)] text-ink2">{t("comparison")}</span>} />
              <GrowthRow label={t("rMrr")}
                value={<ChangeValue value={growthChange(cur.mrr, prev.mrr).change} />}
                badge={<ChangeBadge cls={growthChange(cur.mrr, prev.mrr).cls} />} />
              <GrowthRow label={t("rAvgRev")}
                value={<span className="text-sm font-bold tabular-nums text-brand-dark" dir="ltr">
                  {cur.avgRev == null ? "—" : `${fmt(cur.avgRev)} ${t("sar")}`}
                </span>}
                badge={<span className="chip bg-[rgba(19,63,64,.08)] text-brand-dark">{t("value")}</span>} />
              <GrowthRow indent label={t("growth")}
                value={<ChangeValue value={growthChange(cur.avgRev, prev.avgRev).change} />}
                badge={<ChangeBadge cls={growthChange(cur.avgRev, prev.avgRev).cls} />} />
              {d.hasDays && (
                <>
                  <GrowthRow label={t("rDays")}
                    value={<span className="text-sm font-bold tabular-nums text-brand-dark" dir="ltr">
                      {cur.daysToClose == null ? "—" : `${fmt(cur.daysToClose)} ${t("days")}`}
                    </span>}
                    badge={<span className="chip bg-[rgba(19,63,64,.08)] text-brand-dark">{t("value")}</span>} />
                  <GrowthRow indent label={t("growth")}
                    value={<ChangeValue value={growthChange(cur.daysToClose, prev.daysToClose).change} />}
                    badge={<ChangeBadge cls={(() => {
                      const g = growthChange(cur.daysToClose, prev.daysToClose);
                      if (g.change == null) return null;
                      // fewer days is BETTER — invert classification (site behaviour)
                      const inv = -g.change;
                      return Math.abs(inv) < 0.5 ? "stable" : inv > 0 ? "up" : inv > -10 ? "down" : "sharp";
                    })()} />} />
                </>
              )}
              <GrowthRow label={t("rNps")}
                value={<span className="text-sm font-bold tabular-nums text-brand-dark" dir="ltr">
                  {cur.nps == null ? "—" : fmt(cur.nps)}
                </span>}
                badge={<span className="chip bg-[rgba(19,63,64,.08)] text-brand-dark">{t("value")}</span>} />
              <GrowthRow indent label={t("growth")}
                value={<ChangeValue value={growthChange(cur.nps, prev.nps).change} />}
                badge={<ChangeBadge cls={growthChange(cur.nps, prev.nps).cls} />} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
