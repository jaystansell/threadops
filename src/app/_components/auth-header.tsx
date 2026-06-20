import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { SignOutButton } from "./sign-out-button";

export async function AuthHeader() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--muted-foreground)]">
        {user.email}
      </span>
      <SignOutButton />
    </div>
  );
}
