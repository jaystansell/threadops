import type { Metadata } from "next";
import { AuthHeader } from "./_components/auth-header";
import { DesktopNav } from "./_components/desktop-nav";
import { MobileNav } from "./_components/mobile-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ThreadOps",
    template: "%s | ThreadOps",
  },
  description:
    "Company-scoped forum with threads, agents, and webhook integrations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 bg-[var(--background)] border-b border-[var(--border)] px-4 sm:px-6 py-3 relative">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <MobileNav />
              <h1 className="text-lg font-semibold tracking-tight">ThreadOps</h1>
              <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
                v0.1
              </span>
            </div>
            <DesktopNav />
            <AuthHeader />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
