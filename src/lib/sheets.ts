// Google Sheets fetching + parsing into the Dataset shape.
//
// Reads the whole workbook through Google's xlsx export: one request, every
// cell exactly as the sheet stores it. Numbers stored as numbers arrive exact,
// whatever the sheet's locale.
//
// The previous transport, the gviz feed, typed each column by the majority of
// its cells and silently returned null for any cell of another type. In this
// Arabic-locale sheet a number typed with an ASCII comma — "9,000" — or pasted
// with a trailing line break is stored as text, so revenue plainly visible in
// the sheet never reached the site. The export keeps those cells, and cleanNum
// reads them.
import { strFromU8, unzipSync } from "fflate";
import type { Dataset } from "./types";

/** Source tabs, read by name. Row 1 of each is its column header. */
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
/** A cell as stored, plus display text (`f`) for cells formatted as dates. */
export interface SheetCell { v: string | number | boolean; f?: string }
export type SheetRow = (SheetCell | null | undefined)[];

/**
 * Locale-proof numeric cleanup for TEXT cells. Cells stored as numbers skip
 * this entirely — it only catches values the sheet stored as text.
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

const numC = (c: SheetCell | null | undefined): number | null => {
  if (!c) return null;
  if (typeof c.v === "number") return Number.isFinite(c.v) ? c.v : null;
  if (typeof c.v === "boolean") return c.v ? 1 : 0;
  return cleanNum(c.v);
};

const strC = (c: SheetCell | null | undefined): string => {
  if (!c) return "";
  // dates are stored as serial numbers; `f` holds the date the user sees
  if (c.f != null && c.f.trim() !== "") return c.f.trim();
  return String(c.v).trim();
};

/* ---------------- xlsx reading ---------------- */
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENTITIES[e] ?? m);

/** Text of every <t> run in a fragment — plain and rich-text strings alike. */
const textOf = (xml: string) =>
  decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const attr = (attrs: string, name: string) =>
  attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

/** "AB" → 27 (0-based column index). */
const colIndex = (letters: string) =>
  [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

// Built-in date/time number formats (ECMA-376 §18.8.30), plus any custom
// format whose code — once quoted text, [brackets] and escapes are removed —
// still contains a day, month, year, hour or second token.
const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
]);
const isDateCode = (code: string) => /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""));

/** Indices into cellXfs whose number format is a date. */
function dateStyles(stylesXml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\s([^>]*?)\/?>/g)) {
    const id = attr(m[1], "numFmtId"), code = attr(m[1], "formatCode");
    if (id != null && code != null) custom.set(Number(id), decodeXml(code));
  }
  const xfs = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const out = new Set<number>();
  [...xfs.matchAll(/<xf\s([^>]*?)\/?>/g)].forEach((m, i) => {
    const id = Number(attr(m[1], "numFmtId") ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || isDateCode(custom.get(id) ?? "")) out.add(i);
  });
  return out;
}

/** Spreadsheet date serial → dd/mm/yyyy. */
function serialToDate(serial: number, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.floor(serial) * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function parseSheet(xml: string, strings: string[], dates: Set<number>, date1904: boolean): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const m of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, attrs, inner = ""] = m;
    const ref = attr(attrs, "r")?.match(/^([A-Z]+)(\d+)$/);
    if (!ref) continue;
    const type = attr(attrs, "t") ?? "n";
    const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let cell: SheetCell | null = null;
    if (type === "s") cell = raw != null ? { v: strings[Number(raw)] ?? "" } : null;
    else if (type === "inlineStr") cell = { v: textOf(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "") };
    else if (type === "str") cell = raw != null ? { v: decodeXml(raw) } : null;
    else if (type === "b") cell = raw != null ? { v: raw === "1" } : null;
    else if (type === "e") cell = null; // #DIV/0! and friends carry no value
    else if (raw != null && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        cell = { v: n };
        if (dates.has(Number(attr(attrs, "s") ?? -1))) cell.f = serialToDate(n, date1904);
      }
    }
    if (cell) (rows[Number(ref[2]) - 1] ??= [])[colIndex(ref[1])] = cell;
  }
  return Array.from(rows, (r) => r ?? []);
}

/** Every tab of an xlsx file, by name, as rows of cells (row 1 included). */
export function readWorkbook(zip: Uint8Array): Map<string, SheetRow[]> {
  const pick = (names: Set<string>) => unzipSync(zip, { filter: (f) => names.has(f.name) });
  const index = pick(new Set(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]));
  const workbook = index["xl/workbook.xml"] ? strFromU8(index["xl/workbook.xml"]) : "";
  const rels = index["xl/_rels/workbook.xml.rels"] ? strFromU8(index["xl/_rels/workbook.xml.rels"]) : "";
  if (!workbook) throw new Error("Unexpected workbook export shape");

  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = attr(m[1], "Id"), t = attr(m[1], "Target");
    if (id && t) target.set(id, t.startsWith("/") ? t.slice(1) : `xl/${t}`);
  }
  const sheets = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const name = attr(m[1], "name"), path = target.get(attr(m[1], "r:id") ?? "");
    if (name && path) sheets.set(decodeXml(name), path);
  }

  const files = pick(new Set(["xl/sharedStrings.xml", "xl/styles.xml", ...sheets.values()]));
  const text = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  const strings = [...text("xl/sharedStrings.xml").matchAll(/<si(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/si>)/g)]
    .map((m) => textOf(m[1] ?? ""));
  const dates = dateStyles(text("xl/styles.xml"));
  const date1904 = /<workbookPr\s[^>]*date1904="(?:1|true)"/.test(workbook);

  const out = new Map<string, SheetRow[]>();
  for (const [name, path] of sheets) out.set(name, parseSheet(text(path), strings, dates, date1904));
  return out;
}

/* ---------------- transport ---------------- */
export function exportUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=xlsx`;
}

/** Last-wins dedupe: an appended correction row replaces the original month row. */
const dedupeLast = <T,>(rows: T[], key: (r: T) => string): T[] => {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
};

async function fetchWorkbook(sheetId: string): Promise<Map<string, SheetRow[]>> {
  // 30s server-side cache: many visitors share one upstream fetch
  const res = await fetch(exportUrl(sheetId), { next: { revalidate: 30 } });
  if (res.status === 404) throw new Error("Sheet not found — check the sheet ID");
  if (!res.ok) throw new Error(`Sheet HTTP ${res.status} — make the sheet viewable by link`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // a private sheet answers with Google's sign-in page, not a zip ("PK")
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Sheet is not accessible — make the sheet viewable by link");
  }
  return readWorkbook(buf);
}

export async function fetchDataset(sheetId: string): Promise<Dataset> {
  const book = await fetchWorkbook(sheetId);
  const tab = (name: string): SheetRow[] => {
    const rows = book.get(name);
    if (!rows) throw new Error(`Tab "${name}" not found — keep the sheet's tab names`);
    return rows.slice(1); // row 1 is the column header
  };
  const [companies, companyMonthly, departmentsMonthly, teamMonthly, employees, employeeMonthly] = [
    tab(TABS.companies), tab(TABS.companyMonthly), tab(TABS.departmentsMonthly),
    tab(TABS.teamMonthly), tab(TABS.employees), tab(TABS.employeeMonthly),
  ];
  const reports = book.has(TABS.reports) ? tab(TABS.reports) : []; // optional tab

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
    // The Reports table sits under a banner block, so its own column-header row
    // is data here. Requiring a numeric `#` (column B) drops it — and any future
    // banner row — without depending on the banner's height.
    reports: reports
      .filter((r) => numC(r[1]) != null && (strC(r[3]) || strC(r[2])))
      .map((r) => ({
        num: strC(r[1]), date: strC(r[2]), title: strC(r[3]), category: strC(r[4]),
        relatedTo: strC(r[5]), period: strC(r[6]), file: strC(r[7]), notes: strC(r[8]),
      })),
  };
}
