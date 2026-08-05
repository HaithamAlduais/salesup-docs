"use client";
import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import { RiFilePdf2Line, RiExternalLinkLine, RiFolderOpenLine } from "@remixicon/react";

export default function ReportsPage() {
  const { t } = useLang();
  const { data, loading } = useData();
  const [cat, setCat] = useState<string>("all");

  const reports = useMemo(() => data?.reports ?? [], [data]);
  const cats = useMemo(
    () => Array.from(new Set(reports.map((r) => r.category).filter(Boolean))),
    [reports],
  );
  const filtered = cat === "all" ? reports : reports.filter((r) => r.category === cat);

  if (loading && !data) return <p className="py-20 text-center text-ink2">{t("loading")}</p>;

  return (
    <div>
      <header className="fade-up mb-8">
        <h1 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">{t("reportsTitle")}</h1>
      </header>

      {reports.length === 0 ? (
        <div className="card fade-up flex flex-col items-center gap-3 p-14 text-center">
          <RiFolderOpenLine size={42} className="text-ink3" />
          <p className="max-w-md text-sm leading-7 text-ink2">{t("reportsEmpty")}</p>
        </div>
      ) : (
        <>
          <div className="fade-up mb-6 flex flex-wrap gap-2">
            <button className="pill-btn" data-active={cat === "all"} onClick={() => setCat("all")}>
              {t("allCategories")}
            </button>
            {cats.map((c) => (
              <button key={c} className="pill-btn" data-active={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((r, i) => (
              <div key={`${r.title}-${i}`} className="card fade-up flex items-start gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(220,38,38,.09)] text-danger">
                  <RiFilePdf2Line size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-brand-dark">{r.title || "—"}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink2">
                    {r.category && <span className="chip bg-[rgba(4,203,121,.10)] text-brand-deep">{r.category}</span>}
                    {r.relatedTo && <span>{r.relatedTo}</span>}
                    {r.period && <span dir="ltr">{r.period}</span>}
                    {r.date && <span dir="ltr">{r.date}</span>}
                  </p>
                  {r.notes && <p className="mt-1.5 line-clamp-2 text-xs text-ink3">{r.notes}</p>}
                </div>
                {/^https?:\/\//.test(r.file) && (
                  <a href={r.file} target="_blank" rel="noopener noreferrer"
                    className="chip border border-[var(--line)] text-brand-deep transition hover:border-brand-green"
                    aria-label={t("openFile")}>
                    <RiExternalLinkLine size={14} />
                    {t("openFile")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
