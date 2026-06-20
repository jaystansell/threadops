import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <h2 className="text-2xl font-bold">404</h2>
      <p className="text-[var(--muted-foreground)]">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/threads"
        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
      >
        Go to threads
      </Link>
    </div>
  );
}
