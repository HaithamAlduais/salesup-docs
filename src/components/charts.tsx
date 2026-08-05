"use client";
// Chart components — built per the dataviz skill:
// one axis per chart (small multiples instead of dual axes), validated
// series colors (current #04a868 / previous #0369a1), thin marks, rounded
// data ends, recessive grid, tooltips everywhere, legends for ≥2 series.
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { useLang } from "@/lib/i18n";
import { fmt } from "@/lib/calc";

export const CUR = "var(--chart-cur)";
export const PREV = "var(--chart-prev)";
const GRID = "var(--grid)";
const INK3 = "#94a3b8";

function TipBox({ label, rows }: { label: string; rows: { name: string; value: string; color: string }[] }) {
  return (
    <div className="card px-3 py-2 text-xs shadow-xl" dir="auto">
      <p className="mb-1 font-bold text-brand-dark">{label}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-1.5 text-ink2">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
          {r.name}: <b className="tabular-nums">{r.value}</b>
        </p>
      ))}
    </div>
  );
}

export function PeriodLegend({ curLabel, prevLabel }: { curLabel: string; prevLabel: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-4 text-xs font-bold text-ink2">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#04a868" }} />
        {curLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0369a1" }} />
        {prevLabel}
      </span>
    </div>
  );
}

/* ---------- prev vs current: small-multiple pairs (one scale per metric) ---------- */
export interface PairDatum { key: string; label: string; cur: number; prev: number | null; }

export function PairCompare({ data, curLabel, prevLabel }: {
  data: PairDatum[]; curLabel: string; prevLabel: string;
}) {
  return (
    <div>
      <PeriodLegend curLabel={curLabel} prevLabel={prevLabel} />
      <div className="grid gap-3 sm:grid-cols-3">
        {data.map((d) => {
          const rows = [
            { name: prevLabel, v: d.prev ?? 0, color: "#0369a1", real: d.prev != null },
            { name: curLabel, v: d.cur, color: "#04a868", real: true },
          ];
          const max = Math.max(...rows.map((r) => r.v), 1);
          return (
            <div key={d.key} className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <p className="mb-3 text-xs font-bold text-ink2">{d.label}</p>
              <div className="flex flex-col gap-2.5">
                {rows.map((r) => (
                  <div key={r.name} className="group" title={`${r.name}: ${fmt(r.v)}`}>
                    <div className="mb-0.5 flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-semibold text-ink3">{r.name}</span>
                      <span dir="ltr" className="text-xs font-extrabold tabular-nums text-brand-dark">
                        {r.real ? fmt(r.v) : "—"}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--grid)]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(r.v / max) * 100}%`, background: r.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- sales vs target: monthly bars + target reference line ---------- */
export function TargetBarChart({ data, unit, targetLabel, achievedLabel }: {
  data: { month: string; achieved: number; hasData: boolean; target: number }[];
  unit: string;
  targetLabel: string;
  achievedLabel: string;
}) {
  const target = data[0]?.target ?? 0;
  const { dir } = useLang();
  return (
    <div dir="ltr">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs font-bold text-ink2" dir={dir}>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#04a868" }} />
          {achievedLabel}
        </span>
        {target > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "#133f40" }} />
            {targetLabel}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false} width={44}
            tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            cursor={{ fill: "rgba(4,203,121,.06)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox
                  label={String(label)}
                  rows={[
                    { name: achievedLabel, value: `${fmt(payload[0].value as number)} ${unit}`, color: "#04a868" },
                    { name: targetLabel, value: `${fmt(target)} ${unit}`, color: "#133f40" },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="achieved" radius={[4, 4, 0, 0]} maxBarSize={30}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.hasData ? "#04a868" : "rgba(148,163,184,.25)"} />
            ))}
          </Bar>
          {target > 0 && (
            <ReferenceLine
              y={target} ifOverflow="extendDomain" stroke="#133f40" strokeDasharray="6 5" strokeWidth={2}
              label={{ value: fmt(target), position: "right", fill: "#133f40", fontSize: 11, fontWeight: 700 }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- grouped current-vs-previous bars (single unit family) ---------- */
export function GroupedCompare({ data, curLabel, prevLabel, height = 220 }: {
  data: { label: string; cur: number; prev: number | null }[];
  curLabel: string; prevLabel: string; height?: number;
}) {
  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%" barGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false} width={44}
            tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            cursor={{ fill: "rgba(4,203,121,.06)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox
                  label={String(label)}
                  rows={payload.map((p) => ({
                    name: String(p.name),
                    value: fmt(p.value as number),
                    color: String(p.color),
                  }))}
                />
              ) : null
            }
          />
          <Bar name={prevLabel} dataKey="prev" fill="#0369a1" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar name={curLabel} dataKey="cur" fill="#04a868" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- achieved-vs-target combo: bars + a line across the bar tops ----------
   Plotted as % of target rather than raw values: the four metrics carry
   different units (deals, thousands of SAR, visits), so a shared raw axis would
   flatten the small-count metrics into slivers beside revenue. Percent puts
   them on one comparable scale; the raw achieved/target pair lives in the
   tooltip, and the dashed 100% line is the target itself. */
export interface TargetDatum { label: string; achieved: number; target: number; unit?: string }

const pctOf = (achieved: number, target: number) =>
  target > 0 ? Math.round((achieved / target) * 100) : 0;
const gradeColor = (pct: number) => (pct >= 80 ? "#04a868" : pct >= 60 ? "#d97706" : "#dc2626");

export function TargetCombo({ rows, ofTargetLabel, targetLabel, height = 260 }: {
  rows: TargetDatum[];
  ofTargetLabel: string;
  targetLabel: string;
  height?: number;
}) {
  const data = rows.map((r) => ({ ...r, pct: pctOf(r.achieved, r.target) }));
  // Keep the 100% target line inside the plot even when every metric is short of it.
  const top = Math.max(110, ...data.map((d) => d.pct + 10));

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false}
            interval={0} height={38} tickMargin={8} />
          <YAxis domain={[0, top]} tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false}
            width={48} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "rgba(4,203,121,.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as TargetDatum & { pct: number };
              return (
                <TipBox
                  label={d.label}
                  rows={[
                    {
                      name: ofTargetLabel,
                      value: `${fmt(d.achieved)} / ${fmt(d.target)}${d.unit ? ` ${d.unit}` : ""}`,
                      color: gradeColor(d.pct),
                    },
                    { name: "%", value: `${d.pct}%`, color: "#133f40" },
                  ]}
                />
              );
            }}
          />
          <ReferenceLine
            y={100} stroke="#133f40" strokeDasharray="6 5" strokeWidth={2}
            label={{ value: targetLabel, position: "right", fill: "#133f40", fontSize: 11, fontWeight: 700 }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={gradeColor(d.pct)} />
            ))}
          </Bar>
          {/* the line rides the same series, so its points sit on the bar tops */}
          <Line
            type="linear" dataKey="pct" stroke="#133f40" strokeWidth={2} isAnimationActive={false}
            dot={{ r: 4, fill: "#fff", stroke: "#133f40", strokeWidth: 2 }}
            activeDot={{ r: 5 }} legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
