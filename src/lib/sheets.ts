// Google Sheets (gviz CSV) fetching + parsing into the Dataset shape.
import type { Dataset } from "./types";

export const TABS = {
  companies: "Companies",
  companyMonthly: "Company Monthly",
  departmentsMonthly: "Departments Monthly",
  teamMonthly: "Team Monthly",
  employees: "Employees",
  employeeMonthly: "Employee Monthly",
  reports: "Reports",
} as const;

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const num = (s: string | undefined): number | null => {
  if (s == null) return null;
  const t = s.replace(/[",\s]/g, "").replace(/%$/, "");
  if (t === "" || t === "—") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
const str = (s: string | undefined) => (s ?? "").trim();

export function gvizCsvUrl(sheetId: string, tab: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

/** Last-wins dedupe: an appended correction row replaces the original month row. */
const dedupeLast = <T,>(rows: T[], key: (r: T) => string): T[] => {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
};

async function fetchTab(sheetId: string, tab: string): Promise<string[][]> {
  // 30s server-side cache: many visitors share one upstream fetch (protects gviz quota)
  const res = await fetch(gvizCsvUrl(sheetId, tab), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Tab "${tab}" HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(`Tab "${tab}" is not accessible — make the sheet viewable by link`);
  }
  const rows = parseCsv(text);
  return rows.slice(1); // drop header
}

export async function fetchDataset(sheetId: string): Promise<Dataset> {
  const [companies, companyMonthly, departmentsMonthly, teamMonthly, employees, employeeMonthly] =
    await Promise.all([
      fetchTab(sheetId, TABS.companies),
      fetchTab(sheetId, TABS.companyMonthly),
      fetchTab(sheetId, TABS.departmentsMonthly),
      fetchTab(sheetId, TABS.teamMonthly),
      fetchTab(sheetId, TABS.employees),
      fetchTab(sheetId, TABS.employeeMonthly),
    ]);
  let reports: string[][] = [];
  try {
    reports = await fetchTab(sheetId, TABS.reports);
  } catch { /* Reports tab is optional */ }

  return {
    companies: companies
      .filter((r) => str(r[0]))
      .map((r) => ({
        name: str(r[0]), target: num(r[1]),
        targetType: str(r[2]) || "Revenue", unit: str(r[3]) || "SAR",
      })),
    companyMonthly: dedupeLast(
      companyMonthly
        .filter((r) => num(r[0]) != null && num(r[1]) != null && str(r[2]))
        .map((r) => ({
          year: num(r[0])!, month: num(r[1])!, company: str(r[2]),
          revenue: num(r[3]), deals: num(r[4]), leads: num(r[5]),
          winRate: num(r[6]), pipeline: num(r[7]),
        })),
      (r) => `${r.year}-${r.month}-${r.company}`,
    ),
    departmentsMonthly: dedupeLast(
      departmentsMonthly
        .filter((r) => num(r[0]) != null && num(r[1]) != null && str(r[2]))
        .map((r) => ({
          year: num(r[0])!, month: num(r[1])!, department: str(r[2]),
          active: num(r[3]), newP: num(r[4]), ended: num(r[5]),
          mrr: num(r[6]), avgRev: num(r[7]), daysToClose: num(r[8]), nps: num(r[9]),
        })),
      (r) => `${r.year}-${r.month}-${r.department}`,
    ),
    teamMonthly: dedupeLast(
      teamMonthly
        .filter((r) => num(r[0]) != null && num(r[1]) != null)
        .map((r) => ({
          year: num(r[0])!, month: num(r[1])!,
          agents: num(r[2]), newAgents: num(r[3]), resigned: num(r[4]), retention: num(r[5]),
        })),
      (r) => `${r.year}-${r.month}`,
    ),
    employees: employees
      .filter((r) => str(r[0]))
      .map((r) => ({ name: str(r[0]), role: str(r[1]) || "Sales Specialist", project: str(r[2]) })),
    employeeMonthly: dedupeLast(
      employeeMonthly
        .filter((r) => num(r[0]) != null && num(r[1]) != null && str(r[2]))
        .map((r) => ({
          year: num(r[0])!, month: num(r[1])!, employee: str(r[2]),
          deals: num(r[3]), revenueK: num(r[4]), newDeals: num(r[5]), visits: num(r[6]),
          tDeals: num(r[7]), tRevenueK: num(r[8]), tNewDeals: num(r[9]), tVisits: num(r[10]),
        })),
      (r) => `${r.year}-${r.month}-${r.employee}`,
    ),
    // Reports table lives at B8:I38 in the workbook → columns B.. = index 1..
    reports: reports
      .filter((r) => str(r[3]) || str(r[2]))
      .map((r) => ({
        num: str(r[1]), date: str(r[2]), title: str(r[3]), category: str(r[4]),
        relatedTo: str(r[5]), period: str(r[6]), file: str(r[7]), notes: str(r[8]),
      })),
  };
}
