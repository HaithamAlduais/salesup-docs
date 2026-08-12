// Google Sheets fetching + parsing into the Dataset shape.
//
// Uses the gviz JSON endpoint (not CSV): it returns RAW cell values (`v`)
// alongside the sheet's formatted text (`f`), so numbers arrive as real
// numbers no matter the sheet's locale. The CSV endpoint only ever sends the
// formatted text — an Arabic-locale sheet writes 45000 as "45٬000" (U+066C
// ARABIC THOUSANDS SEPARATOR, not an ASCII comma), which parsed to NaN and
// left every target/revenue blank while small unformatted numbers worked.
import type { Dataset } from "./types";

/**
 * Source tabs. Every request pins `headers=1` rather than letting gviz detect
 * the header count: auto-detection is unreliable on all-text tabs (it reports
 * 0 headers for `Employees` and hands the header row back as data). `Reports`
 * is the one tab whose header is not row 1 — it sits under a banner block — so
 * it carries an extra `#`-column guard in fetchDataset below.
 */
export const TABS = {
  companies: "Companies",
  companyMonthly: "Company Monthly",
  departmentsMonthly: "Departments Monthly",
  teamMonthly: "Team Monthly",
  employees: "Employees",
  employeeMonthly: "Employee Monthly",
  reports: "Reports",
} as const;

/* ---------------- cell helpers ---------------- */
export interface GvizCell { v: unknown; f?: string }
export type GvizRow = (GvizCell | null)[];

/** gviz serialises date cells as the literal string `Date(y,m,d[,h,m,s])` (month is 0-based). */
const GVIZ_DATE = /^Date\((\d+),(\d+),(\d+)(?:,\d+,\d+(?:,\d+)?)?\)$/;

/**
 * Locale-proof numeric cleanup for STRING cells. Raw `v` numbers skip this
 * entirely — it only catches values the sheet stored as text.
 */
export function cleanNum(s: string): number | null {
  let t = s.trim();
  if (t === "" || t === "—" || t === "-") return null;
  // Arabic-Indic ٠-٩ and Extended Arabic-Indic ۰-۹ digits → ASCII
  t = t.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  t = t.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // Arabic decimal separator ٫ → "."
  t = t.replace(/٫/g, ".");
  // Strip thousands separators and noise: ASCII comma, Arabic ٬, apostrophes,
  // every space flavour (incl. NBSP / narrow NBSP / thin), quotes, bidi marks,
  // and percent signs. Written as escapes so no invisible character is load-
  // bearing in this source file.
  t = t.replace(/[,٬'’"\s   ‎‏؜%٪]/g, "");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

const numC = (c: GvizCell | null | undefined): number | null => {
  if (!c || c.v == null) return null;
  if (typeof c.v === "number") return Number.isFinite(c.v) ? c.v : null;
  if (typeof c.v === "boolean") return c.v ? 1 : 0;
  return cleanNum(String(c.v));
};

const strC = (c: GvizCell | null | undefined): string => {
  if (!c || c.v == null) return "";
  // Prefer the sheet's own formatted text: for dates and numbers `v` holds a
  // machine encoding, `f` holds what the user actually sees in the cell.
  if (c.f != null && String(c.f).trim() !== "") return String(c.f).trim();
  if (typeof c.v === "string") {
    const t = c.v.trim();
    const m = GVIZ_DATE.exec(t);
    if (!m) return t;
    const [, y, mo, d] = m;
    return `${d.padStart(2, "0")}/${String(Number(mo) + 1).padStart(2, "0")}/${y}`;
  }
  return String(c.v).trim();
};

/* ---------------- gviz JSON transport ---------------- */
export function gvizJsonUrl(sheetId: string, tab: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(tab)}`;
}

/** Extracts the JSON object from `google.visualization.Query.setResponse(...)`. */
export function extractGvizJson(text: string): {
  status?: string;
  errors?: { detailed_message?: string; message?: string }[];
  table?: { rows?: { c?: GvizRow }[] };
} {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end <= start) throw new Error("Unexpected gviz response shape");
  return JSON.parse(text.slice(start + 1, end));
}

/** Last-wins dedupe: an appended correction row replaces the original month row. */
const dedupeLast = <T,>(rows: T[], key: (r: T) => string): T[] => {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
};

async function fetchTab(sheetId: string, tab: string): Promise<GvizRow[]> {
  // 30s server-side cache: many visitors share one upstream fetch (protects gviz quota)
  const res = await fetch(gvizJsonUrl(sheetId, tab), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Tab "${tab}" HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(`Tab "${tab}" is not accessible — make the sheet viewable by link`);
  }
  const json = extractGvizJson(text);
  if (json.status === "error") {
    const msg = json.errors?.[0]?.detailed_message || json.errors?.[0]?.message || "gviz error";
    throw new Error(`Tab "${tab}": ${msg}`);
  }
  return (json.table?.rows ?? []).map((r) => r.c ?? []);
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
  let reports: GvizRow[] = [];
  try {
    reports = await fetchTab(sheetId, TABS.reports);
  } catch { /* Reports tab is optional */ }

  return {
    companies: companies
      .filter((r) => strC(r[0]))
      .map((r) => ({
        name: strC(r[0]), target: numC(r[1]),
        targetType: strC(r[2]) || "Revenue", unit: strC(r[3]) || "SAR",
      })),
    companyMonthly: dedupeLast(
      companyMonthly
        .filter((r) => numC(r[0]) != null && numC(r[1]) != null && strC(r[2]))
        .map((r) => ({
          year: numC(r[0])!, month: numC(r[1])!, company: strC(r[2]),
          revenue: numC(r[3]), deals: numC(r[4]), leads: numC(r[5]),
          winRate: numC(r[6]), pipeline: numC(r[7]),
        })),
      (r) => `${r.year}-${r.month}-${r.company}`,
    ),
    departmentsMonthly: dedupeLast(
      departmentsMonthly
        .filter((r) => numC(r[0]) != null && numC(r[1]) != null && strC(r[2]))
        .map((r) => ({
          year: numC(r[0])!, month: numC(r[1])!, department: strC(r[2]),
          active: numC(r[3]), newP: numC(r[4]), ended: numC(r[5]),
          mrr: numC(r[6]), avgRev: numC(r[7]), daysToClose: numC(r[8]), nps: numC(r[9]),
        })),
      (r) => `${r.year}-${r.month}-${r.department}`,
    ),
    teamMonthly: dedupeLast(
      teamMonthly
        .filter((r) => numC(r[0]) != null && numC(r[1]) != null)
        .map((r) => ({
          year: numC(r[0])!, month: numC(r[1])!,
          agents: numC(r[2]), newAgents: numC(r[3]), resigned: numC(r[4]), retention: numC(r[5]),
        })),
      (r) => `${r.year}-${r.month}`,
    ),
    employees: employees
      .filter((r) => strC(r[0]))
      .map((r) => ({ name: strC(r[0]), role: strC(r[1]) || "Sales Specialist", project: strC(r[2]) })),
    employeeMonthly: dedupeLast(
      employeeMonthly
        .filter((r) => numC(r[0]) != null && numC(r[1]) != null && strC(r[2]))
        .map((r) => ({
          year: numC(r[0])!, month: numC(r[1])!, employee: strC(r[2]),
          deals: numC(r[3]), revenueK: numC(r[4]), newDeals: numC(r[5]), visits: numC(r[6]),
          tDeals: numC(r[7]), tRevenueK: numC(r[8]), tNewDeals: numC(r[9]), tVisits: numC(r[10]),
          // L is the workbook's "Month Index (auto)" helper; M is the per-month
          // project. Reading past the end of a shorter row yields "" — sheets
          // without the column keep working.
          project: strC(r[12]),
        })),
      (r) => `${r.year}-${r.month}-${r.employee}`,
    ),
    // Reports table sits under a banner block, so the column-header row survives
    // gviz's single-row header strip. Requiring a numeric `#` (column B) drops it
    // — and any future banner row — without depending on the banner's height.
    reports: reports
      .filter((r) => numC(r[1]) != null && (strC(r[3]) || strC(r[2])))
      .map((r) => ({
        num: strC(r[1]), date: strC(r[2]), title: strC(r[3]), category: strC(r[4]),
        relatedTo: strC(r[5]), period: strC(r[6]), file: strC(r[7]), notes: strC(r[8]),
      })),
  };
}
