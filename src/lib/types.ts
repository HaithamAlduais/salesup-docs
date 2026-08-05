export interface Company {
  name: string;
  target: number | null;
  targetType: "Revenue" | "Deals" | string;
  unit: string;
}

export interface CompanyMonthly {
  year: number;
  month: number;
  company: string;
  revenue: number | null;
  deals: number | null;
  leads: number | null;
  winRate: number | null;
  pipeline: number | null;
}

export interface DepartmentMonthly {
  year: number;
  month: number;
  department: string;
  active: number | null;
  newP: number | null;
  ended: number | null;
  mrr: number | null;
  avgRev: number | null;
  daysToClose: number | null;
  nps: number | null;
}

export interface TeamMonthly {
  year: number;
  month: number;
  agents: number | null;
  newAgents: number | null;
  resigned: number | null;
  retention: number | null;
}

export interface Employee {
  name: string;
  role: string;
  project: string;
}

export interface EmployeeMonthly {
  year: number;
  month: number;
  employee: string;
  deals: number | null;
  revenueK: number | null;
  newDeals: number | null;
  visits: number | null;
  tDeals: number | null;
  tRevenueK: number | null;
  tNewDeals: number | null;
  tVisits: number | null;
}

export interface ReportRow {
  num: string;
  date: string;
  title: string;
  category: string;
  relatedTo: string;
  period: string;
  file: string;
  notes: string;
}

export interface Dataset {
  companies: Company[];
  companyMonthly: CompanyMonthly[];
  departmentsMonthly: DepartmentMonthly[];
  teamMonthly: TeamMonthly[];
  employees: Employee[];
  employeeMonthly: EmployeeMonthly[];
  reports: ReportRow[];
}

export type PeriodKind = "monthly" | "quarterly" | "halfYearly" | "yearly";

export interface PeriodWindow {
  start: number; // month index, base Jan-2026 = 1
  span: number;
}
