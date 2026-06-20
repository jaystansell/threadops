export default function WebhooksLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-44 bg-[var(--muted)] rounded" />
        <div className="h-8 w-36 bg-[var(--muted)] rounded-lg" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-[var(--border)] p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-[var(--muted)] rounded" />
              <div className="h-5 w-20 bg-[var(--muted)] rounded-full" />
            </div>
            <div className="h-3 w-2/3 bg-[var(--muted)] rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}
