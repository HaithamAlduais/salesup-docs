"use client";
import type { ReactNode } from "react";
import { useLang, type DictKey } from "@/lib/i18n";
import type { ChangeClass, Status } from "@/lib/calc";
import { fmt } from "@/lib/calc";
import {
  RiArrowUpLine, RiArrowDownLine, RiArrowRightLine,
  RiCheckboxCircleFill, RiErrorWarningFill, RiAlarmWarningFill, RiCircleFill,
} from "@remixicon/react";

/* ---------- change badge ---------- */
const clsStyles: Record<ChangeClass, { bg: string; fg: string; Icon: typeof RiArrowUpLine }> = {
  stable: { bg: "rgba(148,163,184,.16)", fg: "#64748b", Icon: RiArrowRightLine },
  up: { bg: "rgba(4,203,121,.14)", fg: "#04a868", Icon: RiArrowUpLine },
  down: { bg: "rgba(217,119,6,.14)", fg: "#d97706", Icon: RiArrowDownLine },
  sharp: { bg: "rgba(220,38,38,.14)", fg: "#dc2626", Icon: RiArrowDownLine },
};
const clsLabel: Record<ChangeClass, DictKey> = {
  stable: "bStable", up: "bUp", down: "bDown", sharp: "bSharp",
};

export function ChangeBadge({ cls }: { cls: ChangeClass | null }) {
  const { t } = useLang();
  if (!cls) return <span className="chip bg-[rgba(148,163,184,.12)] text-ink3">—</span>;
  const s = clsStyles[cls];
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      <s.Icon size={13} aria-hidden />
      {t(clsLabel[cls])}
    </span>
  );
}

export function ChangeValue({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  const color =
    value == null ? "#94a3b8"
    : Math.abs(value) < 0.5 ? "#64748b"
    : value > 0 ? "#04a868"
    : value > -10 ? "#d97706" : "#dc2626";
  return (
    <span dir="ltr" className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
      {value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`}
    </span>
  );
}

/* ---------- status chip ---------- */
const stStyles: Record<Status, { bg: string; fg: string; label: DictKey; Icon: typeof RiCircleFill }> = {
  excellent: { bg: "rgba(4,203,121,.12)", fg: "#04a868", label: "stExcellent", Icon: RiCheckboxCircleFill },
  follow: { bg: "rgba(217,119,6,.12)", fg: "#d97706", label: "stFollow", Icon: RiErrorWarningFill },
  intervention: { bg: "rgba(220,38,38,.12)", fg: "#dc2626", label: "stIntervention", Icon: RiAlarmWarningFill },
  nodata: { bg: "rgba(148,163,184,.14)", fg: "#64748b", label: "stNoData", Icon: RiCircleFill },
  notarget: { bg: "rgba(148,163,184,.14)", fg: "#64748b", label: "stNoTarget", Icon: RiCircleFill },
};

export function StatusChip({ status }: { status: Status }) {
  const { t } = useLang();
  const s = stStyles[status];
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      <s.Icon size={13} aria-hidden />
      {t(s.label)}
    </span>
  );
}

/* ---------- KPI card ---------- */
export function KpiCard({
  label, value, sub, delay = "",
}: { label: string; value: ReactNode; sub?: ReactNode; delay?: string }) {
  return (
    <div className={`card card-accent fade-up p-5 ${delay}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">{label}</p>
      <p dir="ltr" className="mt-1.5 text-xl sm:text-[26px] font-extrabold leading-tight text-brand-dark tabular-nums">
        {value}
      </p>
      {sub != null && <div className="mt-1.5 text-xs font-semibold text-ink2">{sub}</div>}
    </div>
  );
}

/* ---------- section header ---------- */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[rgba(4,203,121,.25)] pb-2">
      <h2 className="text-lg font-extrabold text-brand-dark">{children}</h2>
      {action}
    </div>
  );
}

export function money(n: number | null | undefined, unit: string) {
  return n == null ? "—" : `${fmt(n)} ${unit}`;
}
