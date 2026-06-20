export default function ThreadDetailLoading() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse">
      <div>
        <div className="h-6 bg-[var(--muted)] rounded w-2/3" />
        <div className="flex items-center gap-2 mt-2">
          <div className="h-5 bg-[var(--muted)] rounded-full w-16" />
          <div className="h-4 bg-[var(--muted)] rounded w-40" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="h-4 bg-[var(--muted)] rounded w-24" />
              <div className="h-3 bg-[var(--muted)] rounded w-32" />
            </div>
            <div className="h-3 bg-[var(--muted)] rounded w-full" />
            <div className="h-3 bg-[var(--muted)] rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-20 bg-[var(--muted)] rounded-lg" />
        <div className="h-9 bg-[var(--muted)] rounded-lg w-28" />
      </div>
    </div>
  );
}
