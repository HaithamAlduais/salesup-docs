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
  /** Exactly what the user last typed — a full URL stays a full URL. */
  sheetInput: string;
  setSheetId: (input: string) => void;
  refresh: () => void;
}

const Ctx = createContext<DataCtx>({
  data: null, source: "demo", error: null, loading: true,
  lastUpdated: null, sheetId: "", sheetInput: "", setSheetId: () => {}, refresh: () => {},
});

const POLL_MS = 60_000;
const ID_KEY = "salesup-sheet-id";
const INPUT_KEY = "salesup-sheet-input";

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
  const [sheetInput, setSheetInputState] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gen = useRef(0); // latest-wins guard against out-of-order responses

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ID_KEY);
      if (saved) setSheetIdState(saved);
      // Sessions saved before the input was kept have only the id — show that.
      setSheetInputState(localStorage.getItem(INPUT_KEY) ?? saved ?? "");
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

  const setSheetId = (input: string) => {
    const raw = input.trim();
    const clean = extractSheetId(raw);
    setLoading(true);
    // The id drives fetching; the raw text is kept only so reopening the dialog
    // shows what was typed instead of the id extracted from it.
    setSheetInputState(clean ? raw : "");
    if (clean === sheetId) {
      void load(clean); // same id re-saved: effect won't re-run, refresh directly
    } else {
      setSheetIdState(clean);
    }
    try {
      if (clean) {
        localStorage.setItem(ID_KEY, clean);
        localStorage.setItem(INPUT_KEY, raw);
      } else {
        localStorage.removeItem(ID_KEY);
        localStorage.removeItem(INPUT_KEY);
      }
    } catch {}
  };

  const refresh = () => { setLoading(true); void load(sheetId); };

  return (
    <Ctx.Provider value={{ data, source, error, loading, lastUpdated, sheetId, sheetInput, setSheetId, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
