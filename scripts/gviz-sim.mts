// Verifies the gviz JSON pipeline against realistic Arabic-locale payloads:
// raw numbers in `v`, Arabic-formatted text in `f`, Arabic-Indic digits, and
// the Reports banner that leaves a stray column-header row in the data.
//
// Runs fully offline — `fetch` is stubbed with fixtures captured from the real
// SalesUp sheet, so this is safe in CI.
//
//   npx tsx scripts/gviz-sim.mts
import { cleanNum, extractGvizJson, fetchDataset, type GvizRow } from "../src/lib/sheets";

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
eq("negative", cleanNum("-1,250"), -1250);
eq("empty", cleanNum(""), null);
eq("em dash", cleanNum("—"), null);
eq("non-numeric text", cleanNum("Report Title"), null);

/* ---------------- gviz envelope ---------------- */
const wire = `/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","status":"ok","table":{"rows":[{"c":[{"v":"PIN"},{"v":45000.0,"f":"45٬000"}]},{"c":[null,null]}]}});`;
const parsed = extractGvizJson(wire);
const rows: GvizRow[] = (parsed.table?.rows ?? []).map((r) => r.c ?? []);
eq("envelope rows parsed", rows.length, 2);
eq("raw target is a NUMBER", rows[0][1]?.v, 45000);
eq("formatted text preserved", rows[0][1]?.f, "45٬000");
eq("empty row -> null cell", rows[1][0], null);

const errJson = extractGvizJson(
  `google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"access_denied","detailed_message":"Sign in required"}]});`,
);
eq("error status detected", errJson.status, "error");

/* ---------------- fetchDataset end-to-end (stubbed transport) ---------------- */
const envelope = (rows: string) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","status":"ok","table":{"rows":[${rows}]}});`;

// Captured shapes from the real Arabic-locale sheet.
const FIXTURES: Record<string, string> = {
  Companies: envelope(
    `{"c":[{"v":"PIN"},{"v":45000.0,"f":"45٬000"},{"v":"Revenue"},{"v":"SAR"}]},` +
      `{"c":[{"v":"MOC"},{"v":240.0,"f":"240"},{"v":"Deals"},{"v":"deals"}]}`,
  ),
  "Company Monthly": envelope(
    `{"c":[{"v":2026.0,"f":"2026"},{"v":1.0,"f":"1"},{"v":"PIN"},{"v":26500.0,"f":"26٬500"},{"v":15.0,"f":"15"},null,null,null]}`,
  ),
  "Departments Monthly": envelope(
    `{"c":[{"v":2026.0},{"v":1.0},{"v":"Totals"},{"v":3.0},{"v":1.0},null,null,null,null,null]}`,
  ),
  "Team Monthly": envelope(`{"c":[{"v":2026.0},{"v":1.0},{"v":6.0},{"v":1.0},{"v":0.0},null]}`),
  Employees: envelope(`{"c":[{"v":"Faisal Al-Qahtani"},{"v":"Sales Specialist"},{"v":"MOC"}]}`),
  "Employee Monthly": envelope(
    `{"c":[{"v":2026.0},{"v":1.0},{"v":"Faisal Al-Qahtani"},{"v":7.0},{"v":26.0},null,null,null,null,null,null]}`,
  ),
  // Row 1 here is the stray column-header row the banner pushes past headers=1,
  // row 2 is a real report with a gviz date cell, row 3 is an unfilled # row.
  Reports: envelope(
    `{"c":[null,null,{"v":"Date"},{"v":"Report Title"},{"v":"Category"},{"v":"Related To"},{"v":"Period"},{"v":"PDF File"},{"v":"Notes"}]},` +
      `{"c":[null,{"v":1.0,"f":"1"},{"v":"Date(2026,7,5)","f":"05/08/2026"},{"v":"Q3 Review"},{"v":"Performance"},{"v":"PIN"},{"v":"Q3"},{"v":"q3.pdf"},null]},` +
      `{"c":[null,{"v":2.0,"f":"2"},null,null,null,null,null,null,null]}`,
  ),
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL) => {
  const tab = decodeURIComponent(new URL(String(url)).searchParams.get("sheet") ?? "");
  const body = FIXTURES[tab];
  if (body == null) throw new Error(`no fixture for tab "${tab}"`);
  return new Response(body, { status: 200 });
}) as typeof fetch;

const ds = await fetchDataset("FAKE_SHEET_ID");
globalThis.fetch = realFetch;

eq("company target parses through Arabic format", ds.companies[0].target, 45000);
eq("plain company target still parses", ds.companies[1].target, 240);
eq("monthly revenue parses", ds.companyMonthly[0].revenue, 26500);
eq("monthly deals parse", ds.companyMonthly[0].deals, 15);
eq("employees header not leaked", ds.employees[0].name, "Faisal Al-Qahtani");
eq("employee count", ds.employees.length, 1);
// The regressions this file exists to catch:
eq("reports: stray header row dropped", ds.reports.length, 1);
eq("reports: real title kept", ds.reports[0].title, "Q3 Review");
eq("reports: date is formatted, not Date(y,m,d)", ds.reports[0].date, "05/08/2026");

console.log(fails ? `\n${fails} FAILURE(S)` : "\nGVIZ JSON PIPELINE PASSED");
process.exit(fails ? 1 : 0);
