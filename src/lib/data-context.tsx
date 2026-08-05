"use client";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import type { Dataset } from "./types";

export type Source = "sheet" | "demo" | "error";

interface DataCtx {
  data: Dataset | null;
  source: Source;
  error: string | null;
  loading: boolean;
  lastUpdated: Date | null;
  sheetId: string;
  setSheetId: (id: string) => void;
  refresh: () => void;
}

const Ctx = createContext<DataCtx>({
  data: null, source: "demo", error: null, loading: true,
  lastUpdated: null, sheetId: "", setSheetId: () => {}, refresh: () => {},
});

const POLL_MS = 60_000;

/** Accepts a full Google Sheets URL or a bare ID and returns the ID. */
export function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return input.trim();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [source, setSource] = useState<Source>("demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sheetId, setSheetIdState] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gen = useRef(0); // latest-wins guard against out-of-order responses

  useEffect(() => {
    try {
      const saved = localStorage.getItem("salesup-sheet-id");
      if (saved) setSheetIdState(saved);
    } catch {}
  }, []);

  const load = useCallback(async (id: string) => {
    const my = ++gen.current;
    try {
      const url = id ? `/api/sheet?id=${encodeURIComponent(id)}` : "/api/sheet";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (my !== gen.current) return; // a newer request superseded this one
      if (json.source === "error") {
        // keep the last good live data on screen — never silently swap to demo
        setData((prev) => prev ?? (json.data as Dataset));
        setSource("error");
        setError(json.error as string);
      } else {
        setData(json.data as Dataset);
        setSource(json.source as Source);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (my !== gen.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setSource("error");
    } finally {
      if (my === gen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(sheetId);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => void load(sheetId), POLL_MS);
    const onFocus = () => void load(sheetId);
    window.addEventListener("focus", onFocus);
    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [sheetId, load]);

  const setSheetId = (id: string) => {
    const clean = extractSheetId(id);
    setLoading(true);
    if (clean === sheetId) {
      void load(clean); // same id re-saved: effect won't re-run, refresh directly
    } else {
      setSheetIdState(clean);
    }
    try {
      if (clean) localStorage.setItem("salesup-sheet-id", clean);
      else localStorage.removeItem("salesup-sheet-id");
    } catch {}
  };

  const refresh = () => { setLoading(true); void load(sheetId); };

  return (
    <Ctx.Provider value={{ data, source, error, loading, lastUpdated, sheetId, setSheetId, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
