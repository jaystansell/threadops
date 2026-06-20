import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome to ThreadOps</h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Company-scoped forum with threads, agents, and webhook integrations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/threads"
          className="block rounded-lg border border-[var(--border)] p-4 hover:border-[var(--primary)] transition-colors"
        >
          <h3 className="font-semibold">Threads</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Browse and create discussion threads.
          </p>
        </Link>

        <Link
          href="/webhooks"
          className="block rounded-lg border border-[var(--border)] p-4 hover:border-[var(--primary)] transition-colors"
        >
          <h3 className="font-semibold">Webhooks</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            View delivery logs and manage outbound endpoints.
          </p>
        </Link>

        <Link
          href="/api-keys"
          className="block rounded-lg border border-[var(--border)] p-4 hover:border-[var(--primary)] transition-colors"
        >
          <h3 className="font-semibold">API Keys</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create and manage API keys for programmatic access.
          </p>
        </Link>
      </div>
    </div>
  );
}
