"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  // nav / global
  brandTag: { ar: "شريكك في النمو", en: "Your growth partner" },
  navHome: { ar: "الرئيسية", en: "Home" },
  navCompanies: { ar: "أداء الشركات", en: "Companies" },
  navPerformance: { ar: "ملخص الأداء", en: "Performance" },
  navTeam: { ar: "الفريق", en: "Team" },
  navReports: { ar: "التقارير", en: "Reports" },
  liveSheet: { ar: "متصل بـ Google Sheets", en: "Live: Google Sheet" },
  demoData: { ar: "بيانات تجريبية", en: "Demo data" },
  sheetError: { ar: "تعذر الوصول للشيت — تُعرض آخر بيانات محمّلة", en: "Sheet unreachable — showing last loaded data" },
  refresh: { ar: "تحديث", en: "Refresh" },
  connectSheet: { ar: "ربط Google Sheet", en: "Connect Google Sheet" },
  connectHint: {
    ar: "الصق رابط الشيت أو المعرّف (ID). يجب أن تكون المشاركة: أي شخص لديه الرابط — عارض.",
    en: "Paste the sheet URL or ID. Sharing must be: Anyone with the link — Viewer.",
  },
  save: { ar: "حفظ", en: "Save" },
  clear: { ar: "إزالة الربط", en: "Disconnect" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  updated: { ar: "آخر تحديث", en: "Updated" },
  // home
  heroTitle1: { ar: "نساعد الشركات على", en: "We help companies" },
  heroTitle2: { ar: "زيادة الإيرادات", en: "grow revenue" },
  heroDesc: {
    ar: "SalesUp تساعد الشركات على زيادة الإيرادات، تحسين عمليات المبيعات، رفع جودة العملاء المحتملين، وبناء أنظمة نمو قابلة للتوسع.",
    en: "SalesUp helps companies increase revenue, optimize sales processes, improve lead quality, and build scalable growth systems.",
  },
  overallAchievement: { ar: "الإنجاز العام", en: "Overall Achievement" },
  status: { ar: "الحالة", en: "Status" },
  companiesCount: { ar: "الشركات", en: "Companies" },
  salesAgents: { ar: "أخصائيو المبيعات", en: "Sales Agents" },
  openDashboards: { ar: "لوحات المتابعة", en: "Dashboards" },
  homeCompaniesDesc: { ar: "مؤشرات كل شركة، المقارنة بالفترة السابقة، المبيعات مقابل الهدف", en: "Per-company KPIs, previous-period comparison, sales vs target" },
  homePerfDesc: { ar: "الأقسام: الإجمالي، خدمات المبيعات، التسويق — المشاريع والإيرادات", en: "Departments: Totals, Sales Services, Marketing — projects & MRR" },
  homeTeamDesc: { ar: "أخصائيو المبيعات، الاحتفاظ، أداء الموظفين مقابل الهدف", en: "Sales agents, retention, employee performance vs target" },
  homeReportsDesc: { ar: "تقارير PDF مصنّفة حسب الفئة", en: "Categorised PDF reports" },
  // periods
  periodType: { ar: "نوع الفترة", en: "Period type" },
  period: { ar: "الفترة", en: "Period" },
  monthly: { ar: "شهري", en: "Monthly" },
  quarterly: { ar: "ربع سنوي", en: "Quarterly" },
  halfYearly: { ar: "نصف سنوي", en: "Half-Yearly" },
  yearly: { ar: "سنوي", en: "Yearly" },
  choosePeriod: { ar: "اختر الفترة", en: "Choose period" },
  // companies page
  companiesTitle: { ar: "أداء الشركات", en: "Company Performance" },
  backToAll: { ar: "→ العودة لكل الشركات", en: "→ All companies" },
  monthlyTarget: { ar: "الهدف الشهري", en: "Monthly Target" },
  currentRevenue: { ar: "الإيراد الحالي", en: "Current Revenue" },
  closedDeals: { ar: "الصفقات المغلقة", en: "Deals Closed" },
  achievement: { ar: "نسبة الإنجاز", en: "Achievement" },
  comparisonPrev: { ar: "المقارنة بالفترة السابقة", en: "Comparison with Previous Period" },
  mRevenue: { ar: "تغير الإيرادات", en: "Revenue Change" },
  mDeals: { ar: "تغير الصفقات", en: "Deals Change" },
  mLeads: { ar: "نمو العملاء المحتملين", en: "Leads Growth" },
  mWin: { ar: "تغير معدل الفوز", en: "Win Rate Change" },
  mPipe: { ar: "تغير خط المبيعات", en: "Pipeline Change" },
  mComp: { ar: "تغير نسبة الإنجاز", en: "Achievement Change" },
  bestIndicator: { ar: "أفضل مؤشر", en: "Best Indicator" },
  worstIndicator: { ar: "أضعف مؤشر", en: "Weakest Indicator" },
  salesVsTarget: { ar: "المبيعات مقابل الهدف", en: "Sales vs Target" },
  selectedYearMonthly: { ar: "السنة المختارة — شهرياً", en: "Selected year — monthly" },
  allCompanies: { ar: "نظرة عامة على كل الشركات", en: "All Companies Overview" },
  colCompany: { ar: "الشركة", en: "Company" },
  colTarget: { ar: "الهدف الشهري", en: "Monthly Target" },
  colAchieved: { ar: "المحقق (الفترة)", en: "Achieved (Period)" },
  colAchievement: { ar: "نسبة الإنجاز", en: "Achievement %" },
  colStatus: { ar: "الحالة", en: "Status" },
  stExcellent: { ar: "ممتاز", en: "Excellent" },
  stFollow: { ar: "يحتاج متابعة", en: "Needs Follow-up" },
  stIntervention: { ar: "يحتاج تدخل", en: "Needs Intervention" },
  stNoData: { ar: "لا توجد بيانات (الفترة)", en: "No data (period)" },
  stNoTarget: { ar: "حدّد الهدف الشهري", en: "Set the monthly target" },
  deals: { ar: "صفقة", en: "deals" },
  sar: { ar: "ر.س", en: "SAR" },
  achieved: { ar: "المحقق", en: "Achieved" },
  target: { ar: "الهدف", en: "Target" },
  current: { ar: "الحالية", en: "Current" },
  previous: { ar: "السابقة", en: "Previous" },
  // change badges
  bStable: { ar: "ثابت", en: "Stable" },
  bUp: { ar: "ارتفاع", en: "Increase" },
  bDown: { ar: "انخفاض", en: "Decrease" },
  bSharp: { ar: "انخفاض حاد", en: "Sharp Decrease" },
  // performance page
  perfTitle: { ar: "ملخص الأداء", en: "Performance Summary" },
  growthComparison: { ar: "مقارنة النمو", en: "Growth Comparison" },
  deptTotals: { ar: "الإجمالي", en: "Totals" },
  deptSales: { ar: "خدمات المبيعات", en: "Sales Services" },
  deptMarketing: { ar: "التسويق", en: "Marketing" },
  activeProjects: { ar: "المشاريع النشطة", en: "Active Projects" },
  newProjects: { ar: "المشاريع الجديدة", en: "New Projects" },
  endedProjects: { ar: "المشاريع المنتهية", en: "Ended Projects" },
  mrr: { ar: "الإيرادات (MRR)", en: "Revenue (MRR)" },
  rTotalActive: { ar: "إجمالي عدد المشاريع النشطة", en: "Total Active Projects" },
  rNew: { ar: "عدد المشاريع الجديدة", en: "New Projects" },
  rStopped: { ar: "عدد المشاريع المتوقفة", en: "Stopped Projects" },
  rMrr: { ar: "الإيرادات الشهرية المتكررة (MRR)", en: "Monthly Recurring Revenue (MRR)" },
  rAvgRev: { ar: "متوسط الإيراد لكل مشروع", en: "Avg Revenue per Project" },
  rDays: { ar: "متوسط عدد الأيام لإغلاق أول صفقة", en: "Avg Days to Close First Deal" },
  rNps: { ar: "نسبة الرضا (NPS)", en: "Customer Satisfaction (NPS)" },
  growth: { ar: "↳ النمو", en: "↳ Growth" },
  was: { ar: "كانت", en: "was" },
  value: { ar: "القيمة", en: "Value" },
  comparison: { ar: "مقارنة", en: "Comparison" },
  days: { ar: "يوم", en: "days" },
  counts: { ar: "الأعداد", en: "Counts" },
  // team page
  teamTitle: { ar: "الفريق", en: "Team" },
  agents: { ar: "أخصائي مبيعات", en: "Sales Agents" },
  newAgents: { ar: "الجدد", en: "New Agents" },
  resigned: { ar: "المستقيلون", en: "Resigned" },
  retention: { ar: "معدل الاحتفاظ", en: "Retention Rate" },
  vsPrev: { ar: "مقابل الفترة السابقة", en: "vs previous" },
  employee: { ar: "الموظف", en: "Employee" },
  allEmployees: { ar: "كل الموظفين", en: "All Employees" },
  allEmployeesIntro: { ar: "عرض بيانات جميع الموظفين مجمعة", en: "Showing aggregated data for all employees" },
  projectThisPeriod: { ar: "المشروع في هذه الفترة", en: "Project this period" },
  currentProject: { ar: "المشروع الحالي", en: "Current project" },
  noCompanyMonths: {
    ar: "لا توجد أشهر مسجّلة لهذه الشركة بعد — أضف بياناتها في شيت Company Monthly.",
    en: "No months recorded for this company yet — add its data in the Company Monthly sheet.",
  },
  perfVsTarget: { ar: "الأداء مقابل الهدف", en: "Performance vs Target" },
  tDeals: { ar: "الصفقات المغلقة", en: "Deals Closed" },
  tRevenue: { ar: "الإيرادات (ألف ر.س)", en: "Revenue (K SAR)" },
  tNewDeals: { ar: "الصفقات الجديدة", en: "New Deals" },
  tVisits: { ar: "الزيارات", en: "Visits" },
  leaderboard: { ar: "أداء الموظفين — الفترة المختارة", en: "Employee Performance — Selected Period" },
  ofTarget: { ar: "من الهدف", en: "of target" },
  // reports
  reportsTitle: { ar: "التقارير", en: "Reports" },
  reportsEmpty: {
    ar: "لا توجد تقارير بعد — أضِف صفوفاً في ورقة Reports داخل الشيت وستظهر هنا.",
    en: "No reports yet — add rows to the Reports tab in your sheet and they appear here.",
  },
  allCategories: { ar: "كل الفئات", en: "All categories" },
  openFile: { ar: "فتح الملف", en: "Open file" },
  // misc
  loading: { ar: "جارٍ التحميل…", en: "Loading…" },
  year2026: { ar: "2026", en: "2026" },
} as const;

export type DictKey = keyof typeof dict;

interface LangCtx {
  lang: Lang;
  t: (k: DictKey) => string;
  setLang: (l: Lang) => void;
  dir: "rtl" | "ltr";
}
const Ctx = createContext<LangCtx>({
  lang: "ar",
  t: (k) => dict[k].ar,
  setLang: () => {},
  dir: "rtl",
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => {
    try {
      const saved = (typeof window !== "undefined" && localStorage.getItem("salesup-lang")) as Lang | null;
      if (saved === "ar" || saved === "en") setLangState(saved);
    } catch {}
  }, []);
  const dir = lang === "ar" ? "rtl" : "ltr";
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("salesup-lang", l); } catch {}
  };
  const t = (k: DictKey) => dict[k][lang];
  return <Ctx.Provider value={{ lang, t, setLang, dir }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
