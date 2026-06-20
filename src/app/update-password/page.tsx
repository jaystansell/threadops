"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createAuthBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        <h2 className="text-xl font-bold">Password updated</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your password has been updated successfully.
        </p>
        <button
          onClick={() => {
            router.push("/threads");
            router.refresh();
          }}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
        >
          Continue to Threadzy
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Set a new password</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            Must be at least 6 characters.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="text-sm text-[var(--muted-foreground)] text-center">
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
