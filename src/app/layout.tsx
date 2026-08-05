import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { DataProvider } from "@/lib/data-context";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "SalesUp — Sales Performance",
  description:
    "SalesUp helps companies increase revenue, optimize sales processes, improve lead quality, and build scalable growth systems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        <LangProvider>
          <DataProvider>
            <Nav />
            <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-24 sm:px-6">
              {children}
            </main>
            <footer className="border-t border-[var(--line)] py-6 text-center text-xs text-ink3">
              SalesUp · Sales Performance CRM
            </footer>
          </DataProvider>
        </LangProvider>
      </body>
    </html>
  );
}
