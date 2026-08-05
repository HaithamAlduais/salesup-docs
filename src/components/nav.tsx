"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import { ConnectSheetDialog } from "./connect-sheet-dialog";
import {
  RiRefreshLine, RiLinksLine, RiGlobalLine, RiMenuLine, RiCloseLine,
} from "@remixicon/react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span dir="ltr" className={`font-[family-name:var(--font-logo)] text-xl font-extrabold tracking-tight ${className}`}>
      <span className="text-brand-dark">Sales</span>
      <span className="text-brand-green">Up</span>
    </span>
  );
}

export function Nav() {
  const { t, lang, setLang } = useLang();
  const { source, loading, lastUpdated, refresh } = useData();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const links = [
    { href: "/", label: t("navHome") },
    { href: "/companies", label: t("navCompanies") },
    { href: "/performance", label: t("navPerformance") },
    { href: "/team", label: t("navTeam") },
    { href: "/reports", label: t("navReports") },
  ];

  const srcChip =
    source === "sheet" ? (
      <span className="chip bg-[rgba(4,203,121,.12)] text-brand-deep">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-green" />
        {t("liveSheet")}
      </span>
    ) : source === "error" ? (
      <span className="chip bg-[rgba(220,38,38,.10)] text-danger">{t("sheetError")}</span>
    ) : (
      <span className="chip bg-[rgba(148,163,184,.15)] text-ink2">{t("demoData")}</span>
    );

  return (
    <>
      {/* preset: menuColor=default-translucent */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="SalesUp home"><Logo /></Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                  path === l.href
                    ? "bg-[rgba(4,203,121,.12)] text-brand-deep"
                    : "text-ink2 hover:text-brand-dark"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* error state must be visible on every viewport */}
            <span className={source === "error" ? "inline-flex" : "hidden sm:inline-flex"}>{srcChip}</span>
            <button
              onClick={refresh}
              title={`${t("refresh")}${lastUpdated ? ` · ${t("updated")} ${lastUpdated.toLocaleTimeString()}` : ""}`}
              aria-label={t("refresh")}
              className="rounded-full border border-[var(--line)] p-2 text-ink2 transition hover:border-brand-green hover:text-brand-deep"
            >
              <RiRefreshLine size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setOpen(true)}
              aria-label={t("connectSheet")}
              title={t("connectSheet")}
              className="rounded-full border border-[var(--line)] p-2 text-ink2 transition hover:border-brand-green hover:text-brand-deep"
            >
              <RiLinksLine size={16} />
            </button>
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1.5 text-xs font-bold text-ink2 transition hover:border-brand-green hover:text-brand-deep"
              aria-label="Toggle language"
            >
              <RiGlobalLine size={14} />
              {lang === "ar" ? "EN" : "عربي"}
            </button>
            <button
              className="rounded-full border border-[var(--line)] p-2 text-ink2 lg:hidden"
              onClick={() => setMenu(!menu)}
              aria-label={lang === "ar" ? "القائمة" : "Menu"}
              aria-expanded={menu}
              aria-controls="mobile-nav"
            >
              {menu ? <RiCloseLine size={16} /> : <RiMenuLine size={16} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" className="border-t border-[var(--line)] bg-white/95 px-4 py-2 lg:hidden" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenu(false)}
                className={`block rounded-xl px-3 py-2.5 text-sm font-bold ${
                  path === l.href ? "bg-[rgba(4,203,121,.12)] text-brand-deep" : "text-ink2"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="px-3 py-2 sm:hidden">{srcChip}</div>
          </nav>
        )}
      </header>
      <ConnectSheetDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
