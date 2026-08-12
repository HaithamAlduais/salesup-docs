// SalesUp calculation engine — 1:1 port of the Excel workbook logic
// (which itself replicates the original SalesUp prototype site).
import type {
  Company, CompanyMonthly, Dataset, DepartmentMonthly, EmployeeMonthly,
  PeriodKind, PeriodWindow, TeamMonthly,
} from "./types";

export const BASE_YEAR = 2026;
export const YEARS = [2026, 2027, 2028, 2029, 2030];
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthIndex = (y: number, m: number) => (y - BASE_YEAR) * 12 + m;

// ---------------- data availability ----------------
// A monthly row always exists for every entity — the sheet pre-builds a
// 12-month block per company and per employee — so "the row is there" says
// nothing about whether the month happened.
//
// A month counts as active when it carries at least one non-zero figure. That
// is the same rule the workbook uses when deciding which months to leave
// empty: a row of nothing but zeros means "no relationship yet", not "we
// measured, and everything was zero". It governs which periods are offered and
// how far the yearly chart runs — never the achievement maths, where a typed 0
// still counts as a measured month.
const anyReal = (...vals: (number | null | undefined)[]) =>
  vals.some((v) => v != null && v !== 0);

export const hasCompanyData = (r: CompanyMonthly) =>
  anyReal(r.revenue, r.deals, r.leads, r.winRate, r.pipeline);

export const hasDeptData = (r: DepartmentMonthly) =>
  anyReal(r.active, r.newP, r.ended, r.mrr, r.avgRev, r.daysToClose, r.nps);

export const hasTeamData = (r: TeamMonthly) =>
  anyReal(r.agents, r.newAgents, r.resigned, r.retention);

export const hasEmployeeData = (r: EmployeeMonthly) =>
  anyReal(r.deals, r.revenueK, r.newDeals, r.visits,
          r.tDeals, r.tRevenueK, r.tNewDeals, r.tVisits) || Boolean(r.project);

/** Sorted, de-duplicated month indices that carry data. */
export function dataMonths<T extends { year: number; month: number }>(
  rows: T[], has: (r: T) => boolean,
): number[] {
  const s = new Set<number>();
  for (const r of rows) if (has(r)) s.add(monthIndex(r.year, r.month));
  return [...s].sort((a, b) => a - b);
}

/** Newest month that has data, as a monthly label; Jan of the base year if none. */
export const latestMonthLabel = (months: number[]) =>
  months.length ? indexToLabel("monthly", months[months.length - 1]) : `${MONTH_ABBR[0]}-${BASE_YEAR}`;

// ---------------- periods ----------------
/**
 * Every period of `kind`, chronologically. Pass `months` to keep only the
 * periods that overlap a month with data — an empty quarter should never be
 * offered as a choice.
 */
export function periodOptions(kind: PeriodKind, months?: number[]): string[] {
  const out: string[] = [];
  for (const y of YEARS) {
    if (kind === "monthly") for (const m of MONTH_ABBR) out.push(`${m}-${y}`);
    if (kind === "quarterly") for (let q = 1; q <= 4; q++) out.push(`Q${q}-${y}`);
    if (kind === "halfYearly") for (let h = 1; h <= 2; h++) out.push(`H${h}-${y}`);
    if (kind === "yearly") out.push(String(y));
  }
  if (!months) return out;
  if (!months.length) return [];
  const set = new Set(months);
  return out.filter((v) => {
    const w = parsePeriod(kind, v);
    if (!w) return false;
    for (let i = w.start; i < w.start + w.span; i++) if (set.has(i)) return true;
    return false;
  });
}

/** The period of `kind` that contains `idx`, if it is on offer. */
export const periodContaining = (kind: PeriodKind, idx: number, options: string[]) =>
  options.find((o) => {
    const w = parsePeriod(kind, o);
    return w != null && idx >= w.start && idx < w.start + w.span;
  });

export function parsePeriod(kind: PeriodKind, value: string): PeriodWindow | null {
  if (!value) return null;
  if (kind === "yearly") {
    const y = parseInt(value, 10);
    if (!Number.isFinite(y)) return null;
    return { start: monthIndex(y, 1), span: 12 };
  }
  if (kind === "quarterly" || kind === "halfYearly") {
    const m = value.match(/^([QH])(\d)-(\d{4})$/);
    if (!m) return null;
    const n = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    const span = kind === "quarterly" ? 3 : 6;
    return { start: monthIndex(y, (n - 1) * span + 1), span };
  }
  const m = value.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mi = MONTH_ABBR.indexOf(m[1]);
  if (mi < 0) return null;
  return { start: monthIndex(parseInt(m[2], 10), mi + 1), span: 1 };
}

export function indexToLabel(kind: PeriodKind, idx: number): string {
  const y = BASE_YEAR + Math.floor((idx - 1) / 12);
  const m = ((idx - 1) % 12 + 12) % 12 + 1;
  if (kind === "monthly") return `${MONTH_ABBR[m - 1]}-${y}`;
  if (kind === "quarterly") return `Q${Math.floor((m - 1) / 3) + 1}-${y}`;
  if (kind === "halfYearly") return `H${Math.floor((m - 1) / 6) + 1}-${y}`;
  return String(y);
}

export const previousLabel = (kind: PeriodKind, w: PeriodWindow) =>
  indexToLabel(kind, w.start - w.span);

// ---------------- shared helpers ----------------
export const pct = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100);

export type ChangeClass = "stable" | "up" | "down" | "sharp";
export function classify(change: number): ChangeClass {
  if (Math.abs(change) < 0.5) return "stable";
  if (change > 0) return "up";
  if (change > -10) return "down";
  return "sharp";
}

export type Status = "excellent" | "follow" | "intervention" | "nodata" | "notarget";
export function companyStatus(comp: number): Status {
  if (comp >= 85) return "excellent";
  if (comp >= 60) return "follow";
  return "intervention";
}
export function overallStatus(comp: number): Status {
  if (comp >= 80) return "excellent";
  if (comp >= 60) return "follow";
  return "intervention";
}

const inWindow = (r: { year: number; month: number }, w: PeriodWindow) => {
  const i = monthIndex(r.year, r.month);
  return i >= w.start && i < w.start + w.span;
};
const sum = (vals: (number | null)[]) =>
  vals.reduce<number>((s, v) => s + (v ?? 0), 0);
const avgOrNull = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => v !== null && v !== undefined);
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
};

// ---------------- companies ----------------
export interface CompanyAgg {
  revenue: number; deals: number; leads: number; pipeline: number;
  winRate: number | null;
  monthsWithData: number;
  base: number;
  comp: number; // integer %
}

export function companyAgg(
  rows: CompanyMonthly[], company: Company, w: PeriodWindow,
): CompanyAgg {
  const rs = rows.filter((r) => r.company === company.name && inWindow(r, w));
  const isDeals = company.targetType === "Deals";
  const revenue = sum(rs.map((r) => r.revenue));
  const deals = sum(rs.map((r) => r.deals));
  const leads = sum(rs.map((r) => r.leads));
  const pipeline = sum(rs.map((r) => r.pipeline));
  const winRate = avgOrNull(rs.map((r) => r.winRate));
  const monthsWithData = rs.filter((r) => (isDeals ? r.deals : r.revenue) != null).length;
  const base = isDeals ? deals : revenue;
  const target = company.target ?? 0;
  const comp = monthsWithData > 0 && target > 0
    ? Math.round((base / monthsWithData) / target * 100)
    : 0;
  return { revenue, deals, leads, pipeline, winRate, monthsWithData, base, comp };
}

export interface MetricChange {
  key: string;
  change: number | null; // percent (or pp for winRate)
  cls: ChangeClass | null;
}

export function companyChanges(cur: CompanyAgg, prev: CompanyAgg): MetricChange[] {
  const mk = (key: string, c: number, p: number): MetricChange => {
    // no baseline → no change to report (never fake "Stable +0.0%")
    if (prev.monthsWithData === 0 || p === 0) return { key, change: null, cls: null };
    const change = pct(c, p);
    return { key, change, cls: classify(change) };
  };
  const win: MetricChange =
    cur.winRate == null || prev.winRate == null
      ? { key: "winRate", change: null, cls: null }
      : { key: "winRate", change: cur.winRate - prev.winRate, cls: classify(cur.winRate - prev.winRate) };
  return [
    mk("revenue", cur.revenue, prev.revenue),
    mk("deals", cur.deals, prev.deals),
    mk("leads", cur.leads, prev.leads),
    win,
    mk("pipeline", cur.pipeline, prev.pipeline),
    mk("achievement", cur.comp, prev.comp),
  ];
}

export function bestWorst(changes: MetricChange[]) {
  // only metrics that actually have a change can be crowned best/worst
  const cands = changes.filter((c) => c.change != null).map((c) => ({ ...c, v: c.change as number }));
  if (!cands.length) {
    const empty = { key: changes[0]?.key ?? "", change: null, cls: null, v: 0 };
    return { best: empty, worst: empty };
  }
  const best = cands.reduce((a, b) => (b.v > a.v ? b : a));
  const worst = cands.reduce((a, b) => (b.v < a.v ? b : a));
  return { best, worst };
}

/**
 * The year's months for one company, trimmed to the span it was actually
 * active: months before the first and after the last measured month are
 * dropped, so a partnership that started in April doesn't open with three
 * empty columns. Gaps *inside* the span are kept — a missed month is a fact
 * worth seeing.
 */
export function companyYearSeries(
  rows: CompanyMonthly[], company: Company, year: number,
) {
  const isDeals = company.targetType === "Deals";
  const all = MONTH_ABBR.map((abbr, i) => {
    const r = rows.find((x) => x.company === company.name && x.year === year && x.month === i + 1);
    const achieved = r ? (isDeals ? r.deals : r.revenue) : null;
    return {
      month: abbr,
      achieved: achieved ?? 0,
      hasData: achieved != null,          // drives the bar colour
      active: r != null && hasCompanyData(r), // drives where the chart starts and ends
      target: company.target ?? 0,
    };
  });
  const first = all.findIndex((m) => m.active);
  if (first < 0) return [];
  let last = all.length - 1;
  while (last > first && !all[last].active) last--;
  return all.slice(first, last + 1);
}

export interface CompanyOverviewRow {
  company: Company;
  achieved: number;
  comp: number | null; // null => no data
  status: Status;
}

export function companiesOverview(
  data: Dataset, w: PeriodWindow,
): CompanyOverviewRow[] {
  return data.companies.map((c) => {
    const agg = companyAgg(data.companyMonthly, c, w);
    if (!c.target) return { company: c, achieved: agg.base, comp: null, status: "notarget" as Status };
    if (agg.monthsWithData === 0) return { company: c, achieved: agg.base, comp: null, status: "nodata" as Status };
    return { company: c, achieved: agg.base, comp: agg.comp, status: companyStatus(agg.comp) };
  });
}

export function overallAchievement(rows: CompanyOverviewRow[]): number {
  const xs = rows.filter((r) => r.comp != null).map((r) => r.comp as number);
  return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : 0;
}

// ---------------- departments ----------------
export interface DeptAgg {
  active: number | null; newP: number | null; ended: number | null;
  mrr: number | null; avgRev: number | null; daysToClose: number | null; nps: number | null;
}

export function deptAgg(
  rows: DepartmentMonthly[], dept: string, w: PeriodWindow,
): DeptAgg {
  const rs = rows.filter((r) => r.department === dept && inWindow(r, w));
  if (!rs.length) return { active: null, newP: null, ended: null, mrr: null, avgRev: null, daysToClose: null, nps: null };
  // active = value at the LAST month in the window that has data (Excel MAXIFS logic)
  const withActive = rs.filter((r) => r.active != null)
    .sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));
  const active = withActive.length ? withActive[withActive.length - 1].active : null;
  const has = (k: keyof DepartmentMonthly) => rs.some((r) => r[k] != null);
  const round0 = (v: number | null) => (v == null ? null : Math.round(v));
  return {
    active,
    newP: has("newP") ? sum(rs.map((r) => r.newP)) : null,
    ended: has("ended") ? sum(rs.map((r) => r.ended)) : null,
    mrr: has("mrr") ? sum(rs.map((r) => r.mrr)) : null,
    avgRev: round0(avgOrNull(rs.map((r) => r.avgRev))),
    daysToClose: round0(avgOrNull(rs.map((r) => r.daysToClose))),
    nps: round0(avgOrNull(rs.map((r) => r.nps))),
  };
}

export function growthChange(cur: number | null, prev: number | null): MetricChange {
  if (cur == null || prev == null) return { key: "", change: null, cls: null };
  const change = pct(cur, prev);
  return { key: "", change, cls: classify(change) };
}

// ---------------- team ----------------
export interface TeamAgg {
  agents: number | null; newAgents: number | null; resigned: number | null; retention: number | null;
}

export function teamAgg(rows: TeamMonthly[], w: PeriodWindow): TeamAgg {
  const rs = rows.filter((r) => inWindow(r, w));
  if (!rs.length) return { agents: null, newAgents: null, resigned: null, retention: null };
  const withAgents = rs.filter((r) => r.agents != null)
    .sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));
  const has = (k: keyof TeamMonthly) => rs.some((r) => r[k] != null);
  const ret = avgOrNull(rs.map((r) => r.retention));
  return {
    agents: withAgents.length ? withAgents[withAgents.length - 1].agents : null,
    newAgents: has("newAgents") ? sum(rs.map((r) => r.newAgents)) : null,
    resigned: has("resigned") ? sum(rs.map((r) => r.resigned)) : null,
    retention: ret == null ? null : Math.round(ret * 100) / 100,
  };
}

export function momChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return pct(cur, prev);
}

// ---------------- employees ----------------
export interface EmployeeAgg {
  deals: number; revenueK: number; newDeals: number; visits: number;
  tDeals: number; tRevenueK: number; tNewDeals: number; tVisits: number;
}

export function employeeAgg(
  rows: EmployeeMonthly[], employee: string | "all", w: PeriodWindow,
): EmployeeAgg {
  const rs = rows.filter((r) => (employee === "all" || r.employee === employee) && inWindow(r, w));
  return {
    deals: sum(rs.map((r) => r.deals)),
    revenueK: sum(rs.map((r) => r.revenueK)),
    newDeals: sum(rs.map((r) => r.newDeals)),
    visits: sum(rs.map((r) => r.visits)),
    tDeals: sum(rs.map((r) => r.tDeals)),
    tRevenueK: sum(rs.map((r) => r.tRevenueK)),
    tNewDeals: sum(rs.map((r) => r.tNewDeals)),
    tVisits: sum(rs.map((r) => r.tVisits)),
  };
}

/**
 * What this person worked on during the selected period: the newest month
 * inside the window that names a project. Empty when the sheet doesn't say —
 * callers fall back to the employee's current project.
 */
export function employeeProject(
  rows: EmployeeMonthly[], employee: string, w: PeriodWindow,
): string {
  const rs = rows
    .filter((r) => r.employee === employee && inWindow(r, w) && Boolean(r.project))
    .sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));
  return rs.length ? rs[rs.length - 1].project ?? "" : "";
}

export const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n));
