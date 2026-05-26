import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { ConfigureAmplify } from "@/components/ConfigureAmplify";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifepoint Men's Group Journal",
  description: "Private guided journaling and discipleship for Lifepoint Church men's groups"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ConfigureAmplify />
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/dashboard">
              Lifepoint Men&apos;s Group Journal
            </Link>
            <AppNav />
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
