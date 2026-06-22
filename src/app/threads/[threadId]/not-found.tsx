import Link from "next/link";
import { StickmanEmptyState } from "@/app/_components/stickman-animations";

export default function ThreadNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <StickmanEmptyState />
      <h2 className="text-lg font-semibold">Thread not found</h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        The thread you&apos;re looking for doesn&apos;t exist or has been
        deleted.
      </p>
      <Link
        href="/threads"
        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
      >
        Back to threads
      </Link>
    </div>
  );
}
