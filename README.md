# SalesUp — Live Sales Performance Website

A Next.js web app that mirrors the SalesUp dashboards and reads **all of its data live from your Google Sheet** (the CRM workbook). Update the sheet → the website updates.

- **Pages:** Home · Company Performance (أداء الشركات) · Performance Summary (ملخص الأداء) · Team (الفريق) · Reports (التقارير)
- **Arabic RTL by default** with a one-click English toggle
- Identical calculation logic to the Excel workbook (statuses, change classification, achievement %, period comparisons) — covered by parity tests

---

## 1 · Turn the Excel workbook into the data source

1. Go to [Google Drive](https://drive.google.com) → **New → File upload** → upload `SalesUp_CRM.xlsx`.
2. Open it → **File → Save as Google Sheets**.
3. **Share** (top right) → *Anyone with the link* → **Viewer** → Copy link.
4. The Sheet ID is the long token in the URL:
   `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGh…XYZ`**`/edit`

> The website reads only these tabs (keep their names): `Companies`, `Company Monthly`, `Departments Monthly`, `Team Monthly`, `Employees`, `Employee Monthly`, and optionally `Reports`. The dashboard tabs in the workbook are ignored by the site — they keep working inside Google Sheets for spreadsheet users.

## 2 · Connect the site to the sheet (two ways)

**A. In the app (no redeploy):** click the 🔗 link icon in the top bar → paste the sheet URL or ID → Save. Stored in the browser; each visitor device sets it once.

**B. For everyone (recommended for production):** set an environment variable so every visitor gets the sheet automatically:

```
SHEET_ID=1AbCdEfGh…XYZ
```

No sheet configured → the site shows the built-in demo dataset (labeled "Demo data").

## 3 · Run locally

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Optional: create `.env.local` with `SHEET_ID=…`.

## 4 · Deploy to Vercel (free)

1. Push this folder to a GitHub repository.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo (defaults are fine).
3. Project → **Settings → Environment Variables** → add `SHEET_ID` → **Redeploy**.

Or from the terminal: `npx vercel` (then `npx vercel --prod`).

## 5 · How "live" works

- The site re-fetches the sheet **every 60 seconds**, whenever the tab regains focus, and on the manual ↻ button.
- Fetching uses Google's public CSV endpoint for link-viewable sheets — no API key, no Google account needed by visitors.
- Sheet unreachable? The site keeps showing the last data and displays a warning chip.

## 6 · Data contract (what the CRM/sheet must contain)

| Tab | Columns (in order) |
|---|---|
| Companies | Company, Monthly Target, Target Type (`Revenue`/`Deals`), Unit |
| Company Monthly | Year, Month (1-12), Company, Revenue (SAR), Deals Closed, Leads, Win Rate (%), Pipeline |
| Departments Monthly | Year, Month, Department (`Totals`/`Sales Services`/`Marketing`), Active Projects, New Projects, Ended Projects, MRR, Avg Revenue per Project, Days to Close, NPS |
| Team Monthly | Year, Month, Sales Agents (Active), New Agents, Resigned Agents, Retention Rate (%) |
| Employees | Employee, Role, Current Project |
| Employee Monthly | Year, Month, Employee, Deals Closed, Revenue (K SAR), New Deals, Visits, Target ×4 |
| Reports *(optional)* | (col A unused), #, Date, Report Title, Category, Related To, Period, PDF link, Notes |

Empty months are ignored by every calculation (they never count as 0% performance) — identical to the workbook.

## 7 · Project map

```
src/lib/calc.ts          calculation engine (ported 1:1 from the Excel workbook)
src/lib/sheets.ts        Google Sheets CSV fetching + parsing
src/lib/data-context.tsx live polling / refresh / sheet-ID storage
src/lib/i18n.tsx         Arabic/English dictionary + RTL switching
src/app/api/sheet/       server route: sheet → JSON (demo fallback)
src/app/…                pages · src/components/… UI + charts
scripts/parity.mts       parity tests vs the workbook's verified numbers
```

Run parity tests: `npx tsx scripts/parity.mts`
