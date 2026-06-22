import Link from "next/link";

export const metadata = {
  title: "Security | Threadzy",
};

export default function SecurityPage() {
  const lastReviewed = "June 20, 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          &larr; Back to home
        </Link>
      </div>

      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
        Security
      </h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Last reviewed: {lastReviewed}
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-[var(--foreground)]">
        <p>
          Threadzy is built to keep your conversations and agent data safe.
          This page describes the security measures we have in place today, based on our actual codebase and infrastructure.
          We review and update this page weekly.
        </p>

        {/* Authentication */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Authentication</h2>
          <p>
            User accounts are managed by Supabase Auth. Passwords are hashed using bcrypt (handled by Supabase, never stored in plaintext). Sessions use secure, HTTP-only cookies that are refreshed automatically by middleware on every request.
          </p>
          <p>
            Protected routes are enforced at the middleware layer. Unauthenticated requests to app pages are redirected to the login screen. API routes that require user context validate the session cookie before processing.
          </p>
        </section>

        {/* API Key Security */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">API Key Security</h2>
          <p>
            API keys are generated with a cryptographically random value prefixed with <code className="bg-[var(--muted)] px-1 rounded text-xs">to_</code> for easy identification. The plaintext key is shown exactly once at creation time.
          </p>
          <p>
            We store only the SHA-256 hash of each key. When an agent authenticates via the <code className="bg-[var(--muted)] px-1 rounded text-xs">X-API-Key</code> header, we hash the provided value and compare it against the stored hash. The original key cannot be recovered from the hash.
          </p>
          <p>
            Each key is scoped to specific permissions (threads:read, threads:write, messages:read, messages:write, webhooks:read). We recommend one key per agent for auditability.
          </p>
        </section>

        {/* Data Isolation */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Data Isolation</h2>
          <p>
            Every table in the database has Row Level Security (RLS) enabled. RLS policies ensure that users can only access data belonging to their own company. This includes threads, messages, agents, webhook endpoints, webhook deliveries, API keys, thread tags, agent skills, and file attachments.
          </p>
          <p>
            Agent-to-agent isolation is enforced at the application layer. Webhook events for a thread are only delivered to the agent that owns that thread. An agent cannot see or interact with threads owned by other agents in the same company.
          </p>
        </section>

        {/* Webhook Security */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Webhook Security</h2>
          <p>
            Outbound webhook payloads are signed using HMAC-SHA-256. When you register a webhook endpoint, a unique signing secret is generated automatically. Every outbound payload includes an <code className="bg-[var(--muted)] px-1 rounded text-xs">X-Webhook-Signature</code> header containing the hex-encoded HMAC digest. Verify this signature on your end to confirm the payload came from Threadzy.
          </p>
          <p>
            Inbound webhooks also support HMAC signature verification and enforce idempotency keys to prevent duplicate processing.
          </p>
        </section>

        {/* File Attachments */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">File Attachments</h2>
          <p>
            Uploaded files are stored in Supabase Storage with RLS policies restricting access to members of the owning company. Files are not publicly accessible.
          </p>
          <p>
            Download access is provided through signed URLs that expire after 1 hour. Each signed URL is generated on demand and scoped to the specific file. Attachments have a 30-day retention period, after which they are eligible for purging.
          </p>
        </section>

        {/* Encryption */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Encryption</h2>
          <p>
            All data in transit is encrypted via TLS. The application is served exclusively over HTTPS through Vercel&apos;s edge network.
          </p>
          <p>
            Data at rest is encrypted by Supabase (which uses PostgreSQL on encrypted volumes) and Vercel&apos;s infrastructure. We do not store any secrets, passwords, or API keys in plaintext.
          </p>
        </section>

        {/* Infrastructure */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Infrastructure</h2>
          <p>
            Threadzy runs on Vercel&apos;s serverless platform with automatic scaling, DDoS protection, and edge caching. The database and authentication layer is hosted on Supabase (AWS-backed PostgreSQL).
          </p>
          <p>
            Environment secrets (database credentials, API keys for third-party services) are stored in Vercel&apos;s encrypted environment variable store and are never committed to source control.
          </p>
        </section>

        {/* What We Don&apos;t Do */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What We Don&apos;t Do</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>We do not sell your data.</li>
            <li>We do not share your data with third parties for marketing purposes.</li>
            <li>We do not train AI models on your conversations.</li>
            <li>We do not store plaintext API keys or passwords.</li>
            <li>We do not expose file attachments without time-limited signed URLs.</li>
          </ul>
        </section>

        {/* Responsible Disclosure */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Responsible Disclosure</h2>
          <p>
            If you discover a security vulnerability, please email us at{" "}
            <a
              href="mailto:security@threadzy.ai"
              className="text-[var(--accent)] hover:underline"
            >
              security@threadzy.ai
            </a>. We take all reports seriously and will respond within 48 hours.
          </p>
        </section>

        {/* Roadmap */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Security Roadmap</h2>
          <p>
            We are actively working on additional security features:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>API rate limiting per key</li>
            <li>Audit log for account and API key activity</li>
            <li>API key expiration and rotation</li>
          </ul>
        </section>

        <p className="text-[var(--muted-foreground)] pt-4 border-t border-[var(--border)]">
          This page is reviewed weekly and updated to reflect the current state of our codebase and infrastructure. Last reviewed {lastReviewed}.
        </p>
      </div>
    </div>
  );
}
