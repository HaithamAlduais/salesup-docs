"use client";
import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import {
  dataMonths, employeeAgg, employeeProject, fmt, hasEmployeeData, hasTeamData, momChange,
  parsePeriod, periodOptions, previousLabel, teamAgg,
} from "@/lib/calc";
import type { PeriodKind } from "@/lib/types";
import { PeriodFilter } from "@/components/period-filter";
import { KpiCard, SectionTitle } from "@/components/ui";
import { TargetCombo } from "@/components/charts";

function Mom({ v }: { v: number | null }) {
  const { t } = useLang();
  const color = v == null ? "#94a3b8" : v > 0 ? "#04a868" : v < 0 ? "#dc2626" : "#64748b";
  return (
    <span className="text-xs font-bold" style={{ color }}>
      {t("vsPrev")}:{" "}
      <span dir="ltr" className="tabular-nums">
        {v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
      </span>
    </span>
  );
}

export default function TeamPage() {
  const { t } = useLang();
  const { data, loading } = useData();
  const [employee, setEmployee] = useState<string>("all");
  const [kind, setKind] = useState<PeriodKind>("monthly");
  const [picked, setPicked] = useState("");

  // headcount months and employee-activity months together — either one makes
  // a period worth offering
  const months = useMemo(
    () => [...new Set([
      ...dataMonths(data?.teamMonthly ?? [], hasTeamData),
      ...dataMonths(data?.employeeMonthly ?? [], hasEmployeeData),
    ])].sort((a, b) => a - b),
    [data],
  );
  const options = useMemo(() => periodOptions(kind, months), [kind, months]);
  const value = options.includes(picked) ? picked : options.at(-1) ?? "";

  const model = useMemo(() => {
    if (!data) return null;
    const w = parsePeriod(kind, value);
    if (!w) return null;
    const pw = { start: w.start - w.span, span: w.span };
    const cur = teamAgg(data.teamMonthly, w);
    const prev = teamAgg(data.teamMonthly, pw);
    const emp = employeeAgg(data.employeeMonthly, employee === "all" ? "all" : employee, w);
    const leaderboard = data.employees.map((e) => ({
      name: e.name,
      agg: employeeAgg(data.employeeMonthly, e.name, w),
    }));
    // the project this person actually worked on during the selected period
    const project = employee === "all" ? "" : employeeProject(data.employeeMonthly, employee, w);
    return { w, cur, prev, emp, project, leaderboard, prevLabel: previousLabel(kind, w) };
  }, [data, kind, value, employee]);

  if (loading && !data) return <p className="py-20 text-center text-ink2">{t("loading")}</p>;
  if (!data || !model) return null;

  const selEmp = data.employees.find((e) => e.name === employee);
  // the month's own project wins; the Employees tab is only the fallback
  const project = model.project || selEmp?.project || "";
  const projectLabel = model.project ? t("projectThisPeriod") : t("currentProject");
  const intro = employee === "all"
    ? t("allEmployeesIntro")
    : [employee, selEmp?.role, project && `${projectLabel}: ${project}`]
        .filter(Boolean).join(" — ");

  return (
    <div>
      <header className="fade-up mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">{t("teamTitle")}</h1>
          <p className="mt-1 text-sm text-ink3">{value || "—"}</p>
        </div>
        <PeriodFilter kind={kind} value={value} onKind={setKind} onValue={setPicked} months={months} />
      </header>

      {/* team KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard delay="d1" label={t("agents")} value={fmt(model.cur.agents ?? 0)}
          sub={<Mom v={momChange(model.cur.agents, model.prev.agents)} />} />
        <KpiCard delay="d2" label={t("newAgents")} value={fmt(model.cur.newAgents ?? 0)}
          sub={<Mom v={momChange(model.cur.newAgents, model.prev.newAgents)} />} />
        <KpiCard delay="d3" label={t("resigned")} value={fmt(model.cur.resigned ?? 0)}
          sub={<Mom v={momChange(model.cur.resigned, model.prev.resigned)} />} />
        <KpiCard delay="d4" label={t("retention")}
          value={model.cur.retention == null ? "—" : `${model.cur.retention}%`}
          sub={<Mom v={momChange(model.cur.retention, model.prev.retention)} />} />
      </div>

      {/* employee selector + intro */}
      <div className="fade-up mt-8 flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-ink2" htmlFor="emp">{t("employee")}:</label>
        <select id="emp" className="select" value={employee} onChange={(e) => setEmployee(e.target.value)}>
          <option value="all">{t("allEmployees")}</option>
          {data.employees.map((e) => (
            <option key={e.name} value={e.name}>{e.name}</option>
          ))}
        </select>
      </div>
      <p className="mt-3 rounded-2xl bg-[rgba(4,203,121,.07)] px-4 py-2.5 text-sm font-semibold text-ink2">
        {intro}
      </p>

      {/* performance vs target */}
      <SectionTitle>{`${t("perfVsTarget")} — ${value}`}</SectionTitle>
      <div className="card p-6">
        <TargetCombo
          ofTargetLabel={t("ofTarget")}
          targetLabel={t("target")}
          rows={[
            { label: t("tDeals"), achieved: model.emp.deals, target: model.emp.tDeals },
            { label: t("tRevenue"), achieved: model.emp.revenueK, target: model.emp.tRevenueK },
            { label: t("tNewDeals"), achieved: model.emp.newDeals, target: model.emp.tNewDeals },
            { label: t("tVisits"), achieved: model.emp.visits, target: model.emp.tVisits },
          ]}
        />
      </div>

      {/* leaderboard */}
      <SectionTitle>{t("leaderboard")}</SectionTitle>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-brand-dark text-white">
              <th className="px-4 py-3 text-start text-xs font-bold">{t("employee")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("tDeals")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("tRevenue")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("tNewDeals")}</th>
              <th className="px-4 py-3 text-start text-xs font-bold">{t("tVisits")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {model.leaderboard.map((r) => (
              <tr key={r.name}
                className={`transition hover:bg-[rgba(4,203,121,.05)] ${r.name === employee ? "bg-[rgba(4,203,121,.07)]" : ""}`}>
                <td className="px-4 py-3">
                  <button className="font-extrabold text-brand-dark hover:text-brand-deep"
                    onClick={() => setEmployee(r.name)}>
                    {r.name}
                  </button>
                </td>
                <td className="px-4 py-3 tabular-nums" dir="ltr">{fmt(r.agg.deals)}</td>
                <td className="px-4 py-3 tabular-nums" dir="ltr">{fmt(r.agg.revenueK)}</td>
                <td className="px-4 py-3 tabular-nums" dir="ltr">{fmt(r.agg.newDeals)}</td>
                <td className="px-4 py-3 tabular-nums" dir="ltr">{fmt(r.agg.visits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
