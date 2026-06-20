export default function ThreadsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-[var(--muted)] rounded" />
        <div className="h-8 w-28 bg-[var(--muted)] rounded-lg" />
      </div>
      <div className="h-10 w-full bg-[var(--muted)] rounded-lg" />
      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-[var(--border)] p-4 space-y-2"
          >
            <div className="h-5 w-3/4 bg-[var(--muted)] rounded" />
            <div className="h-3 w-1/4 bg-[var(--muted)] rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}
