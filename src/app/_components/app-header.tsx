"use client";

import { usePathname } from "next/navigation";

const MARKETING_PATHS = ["/", "/white-paper"];

export function AppHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (MARKETING_PATHS.includes(pathname)) return null;
  return <>{children}</>;
}
