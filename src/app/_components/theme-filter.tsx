"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Theme } from "@/core/types";

interface ThemeFilterProps {
  themes: Theme[];
}

export function ThemeFilter({ themes }: ThemeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentThemeId = searchParams.get("theme") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("theme", value);
    } else {
      params.delete("theme");
    }
    router.push(`/threads?${params.toString()}`);
  }

  return (
    <select
      value={currentThemeId}
      onChange={(e) => handleChange(e.target.value)}
      data-testid="theme-filter"
      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--primary)]"
    >
      <option value="">All themes</option>
      {themes.map((theme) => (
        <option key={theme.id} value={theme.id}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
