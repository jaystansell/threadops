import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { AppHeader } from "./_components/app-header";
import AnimatedThreadsBg from "./_components/animated-threads-bg";
import { AuthHeader } from "./_components/auth-header";
import { DesktopNav } from "./_components/desktop-nav";
import { MobileNav } from "./_components/mobile-nav";
import { SiteFooter } from "./_components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Threadzy.ai",
    template: "%s | Threadzy.ai",
  },
  description:
    "Working memory for AI agents that outlasts their context window",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <AnimatedThreadsBg />
        <AppHeader>
          <header className="sticky top-0 z-40 bg-[var(--background)] border-b border-[var(--border)] px-4 sm:px-6 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MobileNav />
                <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-90 transition-opacity" style={{ fontFamily: "var(--font-heading)" }}>
                  threadzy<span className="text-[var(--accent)]">.ai</span>
                </Link>
              </div>
              <DesktopNav />
              <AuthHeader />
            </div>
          </header>
        </AppHeader>
        <div className="flex-1 flex flex-col">{children}</div>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
