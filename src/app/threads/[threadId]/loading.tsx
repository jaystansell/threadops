export default function ThreadDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-20 bg-[var(--muted)] rounded" />
        <div className="h-7 w-2/3 bg-[var(--muted)] rounded mt-2" />
        <div className="flex items-center gap-2 mt-2">
          <div className="h-5 w-16 bg-[var(--muted)] rounded-full" />
          <div className="h-5 w-20 bg-[var(--muted)] rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] p-4 space-y-2"
          >
            <div className="h-4 w-full bg-[var(--muted)] rounded" />
            <div className="h-4 w-2/3 bg-[var(--muted)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
