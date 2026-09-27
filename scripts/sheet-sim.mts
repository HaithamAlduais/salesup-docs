// Verifies the xlsx-export pipeline against the traps the real SalesUp sheet
// has actually hit: numbers the Arabic-locale sheet stored as TEXT because
// they were typed with an ASCII comma or pasted with a line break, error
// cells, XML entities, rich-text strings, date serials, and the Reports banner
// that leaves a stray column-header row in the data.
//
// Runs fully offline — `fetch` is stubbed with a workbook built in memory,
// so this is safe in CI.
//
//   npx tsx scripts/sheet-sim.mts
import { strToU8, zipSync } from "fflate";
import { cleanNum, fetchDataset } from "../src/lib/sheets";

let fails = 0;
const eq = (n: string, got: unknown, exp: unknown) => {
  const ok = Object.is(got, exp);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${n}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(exp)})`}`);
};

/* ---------------- cleanNum: every locale trap ---------------- */
eq("ASCII comma", cleanNum("45,000"), 45000);
eq("Arabic thousands ٬", cleanNum("45٬000"), 45000);
eq("Arabic-Indic digits", cleanNum("٤٥٬٠٠٠"), 45000);
eq("Extended Arabic-Indic digits", cleanNum("۴۵"), 45);
eq("Arabic decimal ٫", cleanNum("85٫71"), 85.71);
eq("NBSP separator", cleanNum("45 000"), 45000);
eq("narrow NBSP separator", cleanNum("45 000"), 45000);
eq("apostrophe (Swiss)", cleanNum("45'000"), 45000);
eq("percent sign", cleanNum("86%"), 86);
eq("Arabic percent ٪", cleanNum("86٪"), 86);
eq("bidi marks", cleanNum("‏9,000‎"), 9000);
eq("pasted with a line break", cleanNum("23,282\r"), 23282);
eq("negative", cleanNum("-1,250"), -1250);
eq("empty", cleanNum(""), null);
eq("em dash", cleanNum("—"), null);
eq("non-numeric text", cleanNum("Report Title"), null);

/* ---------------- an in-memory workbook, shaped like Google's export ---------------- */
const STRINGS = [
  "Header",              // 0
  "PIN",                 // 1
  "Revenue",             // 2
  "SAR",                 // 3
  "MOC",                 // 4
  "Deals",               // 5
  "deals",               // 6
  "9,000",               // 7  revenue typed with an ASCII comma → stored as TEXT
  "Faisal Al-Qahtani",   // 8
  "Sales Specialist",    // 9
  "R&amp;D",             // 10 entity
  "<r><t>Ministry of </t></r><r><rPr><b/></rPr><t>Culture</t></r>", // 11 rich text
  null,                  // 12 empty <si/> — later indices must not shift
  "Totals",              // 13
  "Q3 Review",           // 14
  "Performance",         // 15
  "https://example.com/q3.pdf", // 16
  "Report Title",        // 17
  "Date",                // 18
  "Q4 Plan",             // 19
];
const sharedStrings =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  STRINGS.map((s) => (s == null ? "<si/>" : s.startsWith("<r>") ? `<si>${s}</si>` : `<si><t>${s}</t></si>`)).join("") +
  `</sst>`;

// xf 0 General · xf 1 built-in date (14) · xf 2 the sheet's 0.0"%" (NOT a date)
// · xf 3 a custom dd/mm/yyyy written as a non-self-closing <xf>
const styles =
  `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0&quot;%&quot;"/><numFmt formatCode="dd/mm/yyyy" numFmtId="165"/></numFmts>` +
  `<cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"><alignment horizontal="left"/></xf></cellXfs>` +
  `</styleSheet>`;

const num = (ref: string, v: number, s?: number) => `<c r="${ref}"${s != null ? ` s="${s}"` : ""}><v>${v}</v></c>`;
const str = (ref: string, i: number) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
const inline = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
const error = (ref: string) => `<c r="${ref}" t="e"><v>#DIV/0!</v></c>`;
const empty = (ref: string) => `<c r="${ref}" s="2"/>`;
const row = (r: number, ...cells: string[]) => `<row r="${r}">${cells.join("")}</row>`;
const sheet = (...rows: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<cols><col min="1" max="3" width="12"/></cols><sheetData>${rows.join("")}</sheetData></worksheet>`;

const SHEETS: Record<string, string> = {
  Companies: sheet(
    row(1, str("A1", 0)),
    row(2, str("A2", 1), num("B2", 45000), str("C2", 2), str("D2", 3)),
    row(3, str("A3", 4), num("B3", 240), str("C3", 5), str("D3", 6)),
  ),
  "Company Monthly": sheet(
    row(1, str("A1", 0)),
    // the regression: August revenue exists, but as text
    row(2, num("A2", 2026), num("B2", 8), str("C2", 1), str("D2", 7), num("E2", 1), num("G2", 50, 2), empty("H2")),
    row(3, num("A3", 2026), num("B3", 7), str("C3", 1), num("D3", 11850), num("E3", 7)),
  ),
  "Departments Monthly": sheet(
    row(1, str("A1", 0)),
    row(2, num("A2", 2026), num("B2", 1), str("C2", 13), num("D2", 3), error("F2")),
  ),
  "Team Monthly": sheet(
    row(1, str("A1", 0)),
    row(2, num("A2", 2026), num("B2", 1), num("C2", 6), num("D2", 1), num("E2", 0)),
  ),
  Employees: sheet(
    row(1, str("A1", 0)),
    row(2, str("A2", 8), str("B2", 9), str("C2", 10)),
  ),
  "Employee Monthly": sheet(
    row(1, str("A1", 0)),
    // pasted revenue: text with a trailing carriage return
    row(2, num("A2", 2026), num("B2", 8), str("C2", 8), num("D2", 23), inline("E2", "23,282&#13;"), str("M2", 11)),
  ),
  // Banner rows, then the table's own header row (row 8), then data.
  Reports: sheet(
    row(1, inline("B1", "REPORTS")),
    row(4, inline("B4", "HOW TO ATTACH A PDF")),
    row(8, inline("B8", "#"), str("C8", 18), str("D8", 17)),
    row(9, num("B9", 1), num("C9", 46239, 1), str("D9", 14), str("E9", 15), str("F9", 1), num("G9", 3, 2), str("H9", 16)),
    row(10, num("B10", 2)),
    row(11, num("B11", 3), num("C11", 46266, 3), str("D11", 19)),
  ),
};

function buildWorkbook(skip?: string): Uint8Array {
  const names = Object.keys(SHEETS).filter((n) => n !== skip);
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`),
    "xl/sharedStrings.xml": strToU8(sharedStrings),
    "xl/styles.xml": strToU8(styles),
  };
  const sheetTags: string[] = [], relTags: string[] = [];
  names.forEach((name, i) => {
    const id = `rId${i + 1}`, file = `worksheets/sheet${i + 1}.xml`;
    files[`xl/${file}`] = strToU8(SHEETS[name]);
    sheetTags.push(`<sheet name="${name}" sheetId="${i + 1}" r:id="${id}"/>`);
    // both Target forms Google has used: relative, and absolute from the root;
    // and attribute order varies
    relTags.push(i % 2
      ? `<Relationship Target="/xl/${file}" Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>`
      : `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${file}"/>`);
  });
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags.join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relTags.join("")}</Relationships>`,
  );
  return zipSync(files);
}

const realFetch = globalThis.fetch;
const serve = (body: Uint8Array | string, status = 200) => {
  // copy into an ArrayBuffer-backed view — BodyInit won't take ArrayBufferLike
  const payload = typeof body === "string" ? body : new Uint8Array(body);
  globalThis.fetch = (async () => new Response(payload, { status })) as typeof fetch;
};
const failure = async (label: string) => {
  try { await fetchDataset("FAKE_SHEET_ID"); return `${label}: no error`; }
  catch (e) { return (e as Error).message; }
};

/* ---------------- fetchDataset end-to-end ---------------- */
serve(buildWorkbook());
const ds = await fetchDataset("FAKE_SHEET_ID");

eq("company target", ds.companies[0].target, 45000);
eq("second company target", ds.companies[1].target, 240);
// The regressions this file exists to catch:
eq("revenue typed as TEXT \"9,000\" is read", ds.companyMonthly[0].revenue, 9000);
eq("revenue stored as a number stays exact", ds.companyMonthly[1].revenue, 11850);
eq("employee revenue pasted with a line break is read", ds.employeeMonthly[0].revenueK, 23282);
eq("win rate under the 0.0\"%\" format is the raw points", ds.companyMonthly[0].winRate, 50);
eq("empty styled cell is null, not 0", ds.companyMonthly[0].pipeline, null);
eq("#DIV/0! cell is null", ds.departmentsMonthly[0].ended, null);
eq("empty shared string does not shift later ones", ds.departmentsMonthly[0].department, "Totals");
eq("XML entity decoded", ds.employees[0].project, "R&D");
eq("rich-text runs joined", ds.employeeMonthly[0].project, "Ministry of Culture");
eq("employees header not leaked", ds.employees[0].name, "Faisal Al-Qahtani");
eq("employee count", ds.employees.length, 1);
eq("team row parses", ds.teamMonthly[0].agents, 6);
eq("reports: banner, stray header and empty # rows dropped", ds.reports.length, 2);
eq("reports: real title kept", ds.reports[0].title, "Q3 Review");
eq("reports: built-in date format → dd/mm/yyyy", ds.reports[0].date, "05/08/2026");
eq("reports: custom date format → dd/mm/yyyy", ds.reports[1].date, "01/09/2026");
eq("reports: a 0.0\"%\" cell is not mistaken for a date", ds.reports[0].period, "3");
eq("reports: link kept", ds.reports[0].file, "https://example.com/q3.pdf");

/* ---------------- failure modes surface a clear message ---------------- */
serve("<!doctype html><title>Sign in – Google Accounts</title>");
eq("private sheet", await failure("private"), "Sheet is not accessible — make the sheet viewable by link");
serve("Not Found", 404);
eq("unknown sheet id", await failure("404"), "Sheet not found — check the sheet ID");
serve(buildWorkbook("Employees"));
eq("renamed tab", await failure("tab"), `Tab "Employees" not found — keep the sheet's tab names`);
serve(buildWorkbook("Reports"));
eq("Reports tab is optional", (await fetchDataset("FAKE_SHEET_ID")).reports.length, 0);

globalThis.fetch = realFetch;
console.log(fails ? `\n${fails} FAILURE(S)` : "\nSHEET PIPELINE PASSED");
process.exit(fails ? 1 : 0);
