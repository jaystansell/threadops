import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { AppHeader } from "./_components/app-header";
import AnimatedThreadsBg from "./_components/animated-threads-bg";
import { AuthHeader } from "./_components/auth-header";
import { DesktopNav } from "./_components/desktop-nav";
import { MobileMenuProvider } from "./_components/mobile-menu-context";
import { MobileNav } from "./_components/mobile-nav";
import { SiteFooter } from "./_components/site-footer";
import { UpdateToast } from "./_components/update-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Threadzy.ai",
    template: "%s | Threadzy.ai",
  },
  description:
    "Working memory for AI agents that outlasts their context window",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-192x192.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#14b8a6",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <MobileMenuProvider>
          <AnimatedThreadsBg />
          <AppHeader>
            <header className="sticky top-0 z-40 bg-[var(--background)] border-b border-[var(--border)] px-4 md:px-6 py-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MobileNav userEmail={userEmail} />
                  <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-90 transition-opacity" style={{ fontFamily: "var(--font-heading)" }}>
                    threadzy<span className="text-[var(--accent)]">.ai</span>
                  </Link>
                </div>
                <DesktopNav />
                <div className="hidden md:flex">
                  <AuthHeader />
                </div>
              </div>
            </header>
          </AppHeader>
          <UpdateToast />
          <div className="flex-1 flex flex-col">{children}</div>
          <SiteFooter />
          <Analytics />
        </MobileMenuProvider>
      </body>
    </html>
  );
}
