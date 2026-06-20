import type { Metadata } from "next";
import { AuthHeader } from "./_components/auth-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThreadOps",
  description: "Company-scoped forum with threads, agents, and webhook integrations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">ThreadOps</h1>
            <span className="text-xs text-[var(--muted-foreground)]">v0.1</span>
          </div>
          <AuthHeader />
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
