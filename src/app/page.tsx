"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import { companiesOverview, overallAchievement, overallStatus, parsePeriod } from "@/lib/calc";
import { KpiCard, StatusChip } from "@/components/ui";
import { Logo } from "@/components/nav";
import {
  RiBuilding2Line, RiLineChartLine, RiTeamLine, RiFilePdf2Line, RiArrowLeftLine, RiArrowRightLine,
} from "@remixicon/react";

const LATEST = "Jun-2026";

export default function Home() {
  const { t, dir } = useLang();
  const { data, loading } = useData();

  const stats = useMemo(() => {
    if (!data) return null;
    const w = parsePeriod("monthly", LATEST)!;
    const ov = companiesOverview(data, w);
    const overall = overallAchievement(ov);
    const agents = data.teamMonthly
      .filter((r) => r.agents != null)
      .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month))
      .at(-1)?.agents ?? 0;
    return { overall, status: overallStatus(overall), companies: data.companies.length, agents };
  }, [data]);

  const Arrow = dir === "rtl" ? RiArrowLeftLine : RiArrowRightLine;
  const cards = [
    { href: "/companies", icon: RiBuilding2Line, title: t("navCompanies"), desc: t("homeCompaniesDesc") },
    { href: "/performance", icon: RiLineChartLine, title: t("navPerformance"), desc: t("homePerfDesc") },
    { href: "/team", icon: RiTeamLine, title: t("navTeam"), desc: t("homeTeamDesc") },
    { href: "/reports", icon: RiFilePdf2Line, title: t("navReports"), desc: t("homeReportsDesc") },
  ];

  return (
    <div>
      {/* hero */}
      <section className="fade-up py-10 text-center sm:py-16">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.3em] text-brand-deep">
          REVENUE GROWTH BRAND
        </p>
        <div className="mb-4 flex justify-center">
          <Logo className="!text-5xl sm:!text-6xl" />
        </div>
        <h1 className="mx-auto max-w-2xl text-2xl font-extrabold leading-snug text-brand-dark sm:text-3xl">
          {t("heroTitle1")}{" "}
          <span className="bg-gradient-to-l from-brand-deep to-brand-dark bg-clip-text text-transparent">
            {t("heroTitle2")}
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-ink2 sm:text-base">
          {t("heroDesc")}
        </p>
      </section>

      {/* live stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          delay="d1"
          label={t("overallAchievement")}
          value={loading || !stats ? "…" : `${stats.overall}%`}
          sub={stats ? <StatusChip status={stats.status} /> : null}
        />
        <KpiCard delay="d2" label={t("status")}
          value={stats ? <StatusChip status={stats.status} /> : "…"} />
        <KpiCard delay="d3" label={t("companiesCount")} value={stats?.companies ?? "…"} />
        <KpiCard delay="d4" label={t("salesAgents")} value={stats?.agents ?? "…"} />
      </section>

      {/* dashboards */}
      <h2 className="mb-4 mt-12 text-lg font-extrabold text-brand-dark">{t("openDashboards")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <Link key={c.href} href={c.href}
            className={`card fade-up d${i + 1} group flex items-center gap-4 p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-green/10`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-dark to-brand-deep text-white">
              <c.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold text-brand-dark">{c.title}</span>
              <span className="mt-0.5 block truncate text-xs text-ink2">{c.desc}</span>
            </span>
            <Arrow size={18} className="shrink-0 text-ink3 transition group-hover:text-brand-deep" />
          </Link>
        ))}
      </div>
    </div>
  );
}
