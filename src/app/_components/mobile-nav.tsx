"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";
import { useMobileMenu } from "./mobile-menu-context";

const NAV_LINKS = [
  { href: "/threads", label: "Threads" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/savings", label: "Savings" },
  { href: "/docs/api", label: "Docs" },
  { href: "/changelog", label: "Changelog" },
];

export function MobileNav({ userEmail }: { userEmail?: string | null }) {
  const { isOpen, toggle, close, setPortalTarget } = useMobileMenu();
  const pathname = usePathname();
  const router = useRouter();
  const isThreadsPage = pathname.startsWith("/threads");

  // Close drawer on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  async function handleSignOut() {
    const supabase = createAuthBrowserClient();
    await supabase.auth.signOut();
    close();
    router.push("/login");
    router.refresh();
  }

  const portalRef = useCallback(
    (el: HTMLDivElement | null) => {
      setPortalTarget(el);
    },
    [setPortalTarget],
  );

  return (
    <div className="md:hidden">
      <button
        onClick={toggle}
        className="p-2 rounded-md hover:bg-[var(--muted)] transition-colors"
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {isOpen ? (
            <>
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </>
          ) : (
            <>
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </>
          )}
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer */}
          <nav className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-[360px] bg-[var(--background)] z-50 flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <span
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                threadzy<span className="text-[var(--accent)]">.ai</span>
              </span>
              <button
                onClick={close}
                className="p-2 rounded-md hover:bg-[var(--muted)] transition-colors"
                aria-label="Close menu"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <div className="px-3 py-2 space-y-0.5 shrink-0">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                    pathname.startsWith(link.href)
                      ? "bg-[var(--muted)] font-medium"
                      : "hover:bg-[var(--muted)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Portal target for thread sidebar content */}
            {isThreadsPage && (
              <>
                <div className="border-t border-[var(--border)] mx-3" />
                <div
                  ref={portalRef}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                />
              </>
            )}

            {/* User info + sign out */}
            {userEmail && (
              <div className="mt-auto border-t border-[var(--border)] px-4 py-3 shrink-0">
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  {userEmail}
                </p>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-1 mt-1"
                >
                  Sign out
                </button>
              </div>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
