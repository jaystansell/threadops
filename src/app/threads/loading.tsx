export default function ThreadsLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse space-y-3 w-full max-w-md px-4">
        <div className="h-4 bg-[var(--muted)] rounded w-3/4" />
        <div className="h-3 bg-[var(--muted)] rounded w-1/2" />
      </div>
    </div>
  );
}
