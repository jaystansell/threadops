"use client";

import { useEffect } from "react";

export default function ThreadsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <h2 className="text-lg font-semibold">Failed to load threads</h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        Something went wrong while fetching your threads.
      </p>
      <button
        onClick={() => unstable_retry()}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
