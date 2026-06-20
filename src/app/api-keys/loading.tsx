export default function ApiKeysLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-[var(--muted)] rounded" />
      </div>
      <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
        <div className="h-4 w-32 bg-[var(--muted)] rounded" />
        <div className="h-10 w-full bg-[var(--muted)] rounded-lg" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-[var(--border)] p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-5 w-32 bg-[var(--muted)] rounded" />
                <div className="h-3 w-24 bg-[var(--muted)] rounded" />
              </div>
              <div className="h-8 w-16 bg-[var(--muted)] rounded-lg" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
