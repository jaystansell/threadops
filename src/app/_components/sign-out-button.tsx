"use client";

import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createAuthBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      data-testid="sign-out-button"
      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
    >
      Sign out
    </button>
  );
}
