import demo from "../src/data/demo-data.json" with { type: "json" };
import {
  parsePeriod, companyAgg, companyChanges, companiesOverview, overallAchievement,
  deptAgg, growthChange, teamAgg, momChange, employeeAgg, previousLabel, classify,
} from "../src/lib/calc";
import type { Dataset } from "../src/lib/types";

const data = demo as unknown as Dataset;
let fails = 0;
const eq = (name: string, got: unknown, exp: unknown, tol = 0.05) => {
  const ok = typeof exp === "number" && typeof got === "number"
    ? Math.abs(got - exp) <= tol : got === exp;
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${got}, expected ${exp}`); }
  else console.log(`ok ${name}: ${got}`);
};

const w = parsePeriod("monthly", "Jun-2026")!;
const pin = data.companies.find(c => c.name === "PIN")!;
const cur = companyAgg(data.companyMonthly, pin, w);
const prev = companyAgg(data.companyMonthly, pin, { start: w.start - w.span, span: w.span });
eq("PIN Jun revenue", cur.revenue, 38500);
eq("PIN Jun deals", cur.deals, 18);
eq("PIN Jun comp %", cur.comp, 86);
eq("prev label", previousLabel("monthly", w), "May-2026");
const ch = companyChanges(cur, prev);
eq("revenue chg", ch[0].change as number, 16.667, 0.01);
eq("deals chg", ch[1].change as number, 20);
eq("leads chg", ch[2].change as number, 10.526, 0.01);
eq("achievement chg", ch[5].change as number, 17.808, 0.01);
eq("classify +16.7", classify(16.7), "up");
eq("classify -22.6", classify(-22.6), "sharp");

const ov = companiesOverview(data, w);
eq("MOC comp", ov.find(r => r.company.name === "MOC")!.comp as number, 83);
eq("flyakeed status", ov.find(r => r.company.name === "flyakeed")!.status, "intervention");
eq("Qubit comp", ov.find(r => r.company.name === "Qubit")!.comp as number, 100);
eq("Eduba status", ov.find(r => r.company.name === "Eduba")!.status, "nodata");
eq("overall", overallAchievement(ov), 79);

const wq = parsePeriod("quarterly", "Q2-2026")!;
const moc = data.companies.find(c => c.name === "MOC")!;
const mocQ = companyAgg(data.companyMonthly, moc, wq);
eq("MOC Q2 deals", mocQ.deals, 369);
eq("MOC Q2 comp", mocQ.comp, 77);

const ss = deptAgg(data.departmentsMonthly, "Sales Services", w);
const ssPrev = deptAgg(data.departmentsMonthly, "Sales Services", { start: w.start - 1, span: 1 });
eq("SS active", ss.active as number, 5);
eq("SS mrr", ss.mrr as number, 47862);
eq("SS avgRev", ss.avgRev as number, 9572);
eq("SS days", ss.daysToClose as number, 7);
eq("SS mrr chg", growthChange(ss.mrr, ssPrev.mrr).change as number, -22.566, 0.01);
eq("SS active chg", growthChange(ss.active, ssPrev.active).change as number, 25);

const t = teamAgg(data.teamMonthly, w);
const tp = teamAgg(data.teamMonthly, { start: w.start - 1, span: 1 });
eq("team agents", t.agents as number, 9);
eq("team resigned", t.resigned as number, 2);
eq("team retention", t.retention as number, 100);
eq("agents MoM", momChange(t.agents, tp.agents) as number, 12.5);
eq("new MoM", momChange(t.newAgents, tp.newAgents) as number, -50);
eq("resigned MoM null", momChange(t.resigned, tp.resigned), null);

const all = employeeAgg(data.employeeMonthly, "all", w);
eq("all deals Jun", all.deals, 47);
eq("all revenueK Jun", all.revenueK, 193);
const yearly = parsePeriod("yearly", "2026")!;
const fais = employeeAgg(data.employeeMonthly, "Faisal Al-Qahtani", yearly);
eq("Faisal yearly deals", fais.deals, 43);

console.log(fails ? `\n${fails} FAILURES` : "\nALL PARITY CHECKS PASSED");
process.exit(fails ? 1 : 0);
