import { NextRequest, NextResponse } from "next/server";
import { fetchDataset } from "@/lib/sheets";
import demoData from "@/data/demo-data.json";
import type { Dataset } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || process.env.SHEET_ID || "";
  if (!id) {
    return NextResponse.json(
      { source: "demo", fetchedAt: new Date().toISOString(), data: demoData as unknown as Dataset },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
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
