"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function MobileMainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isThreadRoot = pathname === "/threads";
  const isThreadDetail = pathname.startsWith("/threads/") && pathname !== "/threads/new";

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
      <div className={isThreadRoot ? "hidden md:block flex-1 overflow-y-auto p-4 sm:p-6" : "flex-1 overflow-y-auto p-4 sm:p-6"}>
        {children}
      </div>
    </>
  );
}
