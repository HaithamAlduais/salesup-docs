"use client";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/data-context";
import { RiCloseLine, RiFileExcel2Line } from "@remixicon/react";

export function ConnectSheetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const { sheetId, sheetInput, setSheetId } = useData();
  const [value, setValue] = useState("");

  useEffect(() => { if (open) setValue(sheetInput); }, [open, sheetInput]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-dark/30 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("connectSheet")}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-dark">
            <RiFileExcel2Line className="text-brand-deep" size={20} />
            {t("connectSheet")}
          </h2>
          <button onClick={onClose} aria-label={t("cancel")} className="rounded-full p-1 text-ink3 hover:text-ink">
            <RiCloseLine size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm leading-6 text-ink2">{t("connectHint")}</p>
        <input
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…  or  1AbC…"
          className="mb-4 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-mono text-xs text-ink outline-none focus:border-brand-green"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sheetId && (
            <button
              onClick={() => { setSheetId(""); onClose(); }}
              className="rounded-full px-4 py-2 text-sm font-bold text-danger hover:bg-[rgba(220,38,38,.08)]"
            >
              {t("clear")}
            </button>
          )}
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-ink2 hover:bg-black/5">
            {t("cancel")}
          </button>
          <button
            onClick={() => { setSheetId(value); onClose(); }}
            className="rounded-full bg-gradient-to-l from-brand-green to-brand-dark px-5 py-2 text-sm font-bold text-white shadow-lg shadow-brand-green/25 transition hover:brightness-110"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
