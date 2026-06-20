"use client";

import { useRouter, useSearchParams } from "next/navigation";

const GROUP_OPTIONS = [
  { value: "timeline", label: "By timeline" },
  { value: "agent", label: "By agent" },
] as const;

export function GroupFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("group") ?? "timeline";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "timeline") {
      params.delete("group");
    } else {
      params.set("group", value);
    }
    router.push(`/threads?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      data-testid="group-filter"
      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--primary)]"
    >
      {GROUP_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
