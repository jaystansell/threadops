"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    params.delete("page"); // reset to page 1 on new search
    const qs = params.toString();
    router.push(`/threads${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2" data-testid="search-form">
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search threads..."
        data-testid="search-input"
        className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
      />
      <button
        type="submit"
        data-testid="search-submit"
        className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--muted)] hover:bg-[var(--border)] transition-colors"
      >
        Search
      </button>
    </form>
  );
}
