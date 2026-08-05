"use client";
import { useMemo, useState } from "react";
import { useLang, type DictKey } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import {
  bestWorst, companiesOverview, companyAgg, companyChanges, companyStatus,
  companyYearSeries, fmt, parsePeriod, previousLabel,
} from "@/lib/calc";
import type { PeriodKind } from "@/lib/types";
import { PeriodFilter } from "@/components/period-filter";
import { ChangeBadge, ChangeValue, KpiCard, SectionTitle, StatusChip } from "@/components/ui";
import { PairCompare, TargetBarChart } from "@/components/charts";

const METRIC_LABELS: DictKey[] = ["mRevenue", "mDeals", "mLeads", "mWin", "mPipe", "mComp"];

export default function CompaniesPage() {
  const { t, lang } = useLang();
  const { data, loading } = useData();
  const [selected, setSelected] = useState<string>("");
  const [kind, setKind] = useState<PeriodKind>("monthly");
  const [value, setValue] = useState("Jun-2026");

  const companies = data?.companies ?? [];
  const selName = selected || companies[0]?.name || "";
  const company = companies.find((c) => c.name === selName);

  const model = useMemo(() => {
    if (!data || !company) return null;
    const w = parsePeriod(kind, value);
    if (!w) return null;
    const cur = companyAgg(data.companyMonthly, company, w);
    const prev = companyAgg(data.companyMonthly, company, { start: w.start - w.span, span: w.span });
    const changes = companyChanges(cur, prev);
    const { best, worst } = bestWorst(changes);
    const year = parseInt(value.match(/\d{4}/)?.[0] ?? "2026", 10);
    const series = companyYearSeries(data.companyMonthly, company, year);
    const overview = companiesOverview(data, w);
    const unit = company.targetType === "Deals" ? t("deals") : t("sar");
    const status = cur.monthsWithData === 0 ? ("nodata" as const)
      : !company.target ? ("notarget" as const)
      : companyStatus(cur.comp);
    return { w, cur, prev, changes, best, worst, series, overview, unit, status, prevLabel: previousLabel(kind, w) };
  }, [data, company, kind, value, t]);

  if (loading && !data) return <p className="py-20 text-center text-ink2">{t("loading")}</p>;
  if (data && companies.length === 0)
    return <div className="card p-14 text-center text-sm text-ink2">{t("reportsEmpty")}</div>;
  if (!data || !company || !model) return null;

  const metricLabel = (key: string) => {
    const idx = ["revenue", "deals", "leads", "winRate", "pipeline", "achievement"].indexOf(key);
    return t(METRIC_LABELS[idx] ?? "mRevenue");
  };
  const changeSuffix = (key: string) =>
    key === "winRate" ? (lang === "ar" ? " نقطة" : " pp") : "%";

  return (
    <div>
      <header className="fade-up mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">{t("companiesTitle")}</h1>
          <p className="mt-1 text-sm text-ink3">{value}</p>
        </div>
        <PeriodFilter kind={kind} value={value} onKind={setKind} onValue={setValue} />
      </header>

      {/* company pills */}
      <div className="fade-up d1 mb-8 flex flex-wrap gap-2">
        {companies.map((c) => (
          <button key={c.name} className="pill-btn" data-active={c.name === selName}
            onClick={() => setSelected(c.name)}>
            {c.name}
          </button>
        ))}
      </div>

      {/* selected company header */}
      <div className="fade-up d1 mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold text-brand-dark">{company.name}</h2>
        <StatusChip status={model.status} />
        <span className="chip border border-[var(--line)] bg-white text-brand-deep">
          {t("monthlyTarget")}: {company.target ? `${fmt(company.target)} ${model.unit}` : "—"}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard delay="d1" label={t("monthlyTarget")}
          value={company.target ? `${fmt(company.target)} ${model.unit}` : "—"} />
        <KpiCard delay="d2" label={t("currentRevenue")}
          value={`${fmt(model.cur.revenue)} ${t("sar")}`} />
        <KpiCard delay="d3" label={t("closedDeals")} value={fmt(model.cur.deals)} />
        <KpiCard delay="d4" label={t("achievement")}
          value={`${model.cur.comp}%`}
          sub={<StatusChip status={model.status} />} />
      </div>

      {/* comparison with previous period */}
      <SectionTitle>{t("comparisonPrev")}</SectionTitle>
      <div className="card divide-y divide-[var(--line)] overflow-hidden">
        {model.changes.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <span className="text-sm font-bold text-ink">{metricLabel(m.key)}</span>
            <span className="flex items-center gap-3">
              <ChangeValue value={m.change} suffix={changeSuffix(m.key)} />
              <ChangeBadge cls={m.cls} />
            </span>
          </div>
        ))}
      </div>

      {/* best / worst */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card fade-up p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">{t("bestIndicator")}</p>
          <p className="mt-1 font-extrabold text-brand-dark">{metricLabel(model.best.key)}</p>
          <ChangeValue value={model.best.change} suffix={changeSuffix(model.best.key)} />
        </div>
        <div className="card fade-up d1 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">{t("worstIndicator")}</p>
          <p className="mt-1 font-extrabold text-brand-dark">{metricLabel(model.worst.key)}</p>
          <ChangeValue value={model.worst.change} suffix={changeSuffix(model.worst.key)} />
        </div>
      </div>

      {/* prev vs current small multiples */}
      <SectionTitle>{`${value} ↔ ${model.prevLabel}`}</SectionTitle>
      <div className="card p-5">
        <PairCompare
          curLabel={value}
          prevLabel={model.prevLabel}
          data={[
            { key: "revenue", label: t("mRevenue"), cur: model.cur.revenue, prev: model.prev.monthsWithData ? model.prev.revenue : null },
            { key: "deals", label: t("mDeals"), cur: model.cur.deals, prev: model.prev.monthsWithData ? model.prev.deals : null },
            { key: "leads", label: t("mLeads"), cur: model.cur.leads, prev: model.prev.monthsWithData ? model.prev.leads : null },
          ]}
        />
      </div>

      {/* sales vs target */}
      <SectionTitle>{`${t("salesVsTarget")} — ${t("selectedYearMonthly")}`}</SectionTitle>
      <div className="card p-5">
        <TargetBarChart
          data={model.series}
          unit={model.unit}
          targetLabel={t("target")}
          achievedLabel={t("achieved")}
        />
      </div>

      {/* all companies overview */}
      <SectionTitle>{t("allCompanies")}</SectionTitle>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-brand-dark text-white">
              <th className="px-4 py-3 text-start text-xs font-bold">{t("colCompany")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("colTarget")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("colAchieved")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("colAchievement")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {model.overview.map((r) => (
              <tr key={r.company.name}
                className={`transition hover:bg-[rgba(4,203,121,.05)] ${r.company.name === selName ? "bg-[rgba(4,203,121,.07)]" : ""}`}>
                <td className="px-4 py-3">
                  <button className="font-extrabold text-brand-dark hover:text-brand-deep"
                    onClick={() => setSelected(r.company.name)}>
                    {r.company.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-ink2" dir="ltr">
                  {r.company.target
                    ? `${fmt(r.company.target)} ${r.company.targetType === "Deals" ? t("deals") : t("sar")}`
                    : "—"}
                </td>
                <td className="px-4 py-3 font-bold tabular-nums text-brand-dark" dir="ltr">{fmt(r.achieved)}</td>
                <td className="px-4 py-3">
                  {r.comp == null ? <span className="text-ink3">—</span> : (
                    <span className="font-extrabold tabular-nums"
                      style={{ color: r.status === "excellent" ? "#04a868" : r.status === "follow" ? "#d97706" : "#dc2626" }}>
                      {r.comp}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusChip status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
