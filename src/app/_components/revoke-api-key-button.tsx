"use client";

import { useState } from "react";

interface Props {
  companyId: string;
  keyId: string;
}

export function RevokeApiKeyButton({ companyId, keyId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRevoke() {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/api-keys/${keyId}/revoke`,
        { method: "PATCH" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke key");
      }
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke key");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRevoke}
      disabled={loading}
      data-testid="revoke-api-key"
      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
    >
      {loading ? "Revoking..." : "Revoke"}
    </button>
  );
}
