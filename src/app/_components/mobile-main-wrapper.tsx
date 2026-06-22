"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMobileMenu } from "./mobile-menu-context";

export function MobileMainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isThreadRoot = pathname === "/threads";
  const isThreadDetail = pathname.startsWith("/threads/") && pathname !== "/threads/new";
  const { toggle } = useMobileMenu();

  return (
    <>
      {isThreadDetail && (
        <div className="md:hidden px-4 pt-3 pb-1">
          <Link
            href="/threads"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Threads
          </Link>
        </div>
      )}
      {/* Mobile /threads root: prompt to open menu */}
      {isThreadRoot && (
        <div className="md:hidden flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)] mb-3">
            Tap the menu to browse your threads
          </p>
          <button
            onClick={toggle}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Open Menu
          </button>
        </div>
      )}
      <div className={isThreadRoot ? "hidden md:block flex-1 overflow-y-auto p-4 md:p-6" : "flex-1 overflow-y-auto p-4 md:p-6"}>
        {children}
      </div>
    </>
  );
}
