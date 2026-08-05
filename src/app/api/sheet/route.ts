import { NextRequest, NextResponse } from "next/server";
import { fetchDataset } from "@/lib/sheets";
import demoData from "@/data/demo-data.json";
import type { Dataset } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Default sheet: the SalesUp CRM Google Sheet (override with ?id= or SHEET_ID env). */
const DEFAULT_SHEET_ID = "17AnhC5Z2tQQF1Wy2IBnBvRJ-g2MJ5AO65OongmJ7XyU";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || process.env.SHEET_ID || DEFAULT_SHEET_ID;
  // No "no sheet configured" branch: DEFAULT_SHEET_ID always resolves, so the
  // demo dataset is now reached only when the sheet itself is unreachable.
  try {
    const data = await fetchDataset(id);
    return NextResponse.json(
      { source: "sheet", sheetId: id, fetchedAt: new Date().toISOString(), data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        source: "error",
        error: e instanceof Error ? e.message : String(e),
        fetchedAt: new Date().toISOString(),
        data: demoData as unknown as Dataset,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
