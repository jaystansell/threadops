"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createAuthBrowserClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    if (data.session) {
      router.push("/threads");
      router.refresh();
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="max-w-sm mx-auto space-y-4">
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          We sent a confirmation link to <strong>{email}</strong>. Click the link
          to activate your account.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Create a ThreadOps account</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Sign up with your email and password.
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

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="text-sm text-[var(--muted-foreground)] text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
