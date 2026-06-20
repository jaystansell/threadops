"use client";

import { useState } from "react";
import Link from "next/link";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createAuthBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          We sent a password reset link to <strong>{email}</strong>.
          Click the link in the email to set a new password.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Reset your password</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Enter your email and we will send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="text-sm text-[var(--muted-foreground)] text-center">
        Remember your password?{" "}
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
