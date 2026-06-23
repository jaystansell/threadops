import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import type { CompanyId } from "@/core/types";
import { AuthorizeForm } from "./authorize-form";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AuthorizePage({ searchParams }: Props) {
  const params = await searchParams;
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = params;

  // Validate required params
  if (response_type !== "code") {
    return (
      <ErrorPage message="Invalid request: response_type must be 'code'" />
    );
  }
  if (!client_id || !redirect_uri || !code_challenge) {
    return (
      <ErrorPage message="Invalid request: missing client_id, redirect_uri, or code_challenge" />
    );
  }
  if (code_challenge_method && code_challenge_method !== "S256") {
    return (
      <ErrorPage message="Invalid request: only S256 code_challenge_method is supported" />
    );
  }

  // Check authentication
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login, preserving all OAuth params so we can return here
    const returnUrl = `/oauth/authorize?${new URLSearchParams(
      params as Record<string, string>,
    ).toString()}`;
    redirect(`/login?next=${encodeURIComponent(returnUrl)}`);
  }

  // Get user's company and API keys
  const db = createServerClient();
  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <ErrorPage message="You need to be part of a team to authorize applications." />;
  }

  const apiKeyRepo = createApiKeyRepo(db);
  const keys = await apiKeyRepo.listByCompany(
    membership.company_id as CompanyId,
  );
  const activeKeys = keys.filter((k) => !k.revoked_at);

  const requestedScopes = scope ? scope.split(" ").filter(Boolean) : [];

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Authorize Application</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">
            {client_id}
          </span>{" "}
          wants to access your Threadzy account.
        </p>
      </div>

      {requestedScopes.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
          <p className="text-sm font-medium">Requested permissions:</p>
          <ul className="space-y-1">
            {requestedScopes.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <svg
                  className="w-4 h-4 text-[var(--accent)] shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4"
                  />
                </svg>
                <code className="text-xs bg-[var(--muted)] px-1.5 py-0.5 rounded">
                  {s}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AuthorizeForm
        apiKeys={activeKeys.map((k) => ({
          id: k.id,
          label: k.label,
          key_prefix: k.key_prefix,
          scopes: k.scopes,
        }))}
        clientId={client_id}
        redirectUri={redirect_uri}
        scope={scope || ""}
        state={state || ""}
        codeChallenge={code_challenge}
        codeChallengeMethod={code_challenge_method || "S256"}
        companyId={membership.company_id}
      />
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-4">
      <h1 className="text-xl font-bold">Authorization Error</h1>
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}
