"use client";

import { useState } from "react";

const BASE_URL = "https://threadops-jade.vercel.app";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface QueryParam {
  name: string;
  description: string;
  required?: boolean;
}

interface Endpoint {
  method: Method;
  path: string;
  summary: string;
  description: string;
  auth: "cookie" | "apiKey";
  params?: QueryParam[];
  requestBody?: { schema: Record<string, unknown>; example: unknown };
  responseExample: unknown;
  errorCodes?: { status: number; description: string }[];
}

interface Section {
  id: string;
  title: string;
  endpoints: Endpoint[];
}

const SECTIONS: Section[] = [
  {
    id: "threads",
    title: "Threads",
    endpoints: [
      {
        method: "GET",
        path: "/api/threads",
        summary: "List threads",
        description:
          "Returns a paginated list of threads for the authenticated user's company. Supports search and theme filtering.",
        auth: "apiKey",
        params: [
          { name: "q", description: "Search threads by title (case-insensitive substring match)." },
          { name: "status", description: "Filter by status: open, closed, or archived. Omit for all." },
          { name: "limit", description: "Number of threads to return (default 100, max 200)." },
          { name: "offset", description: "Number of threads to skip (default 0). Use for pagination." },
        ],
        responseExample: [
          {
            id: "t_abc123",
            company_id: "c_xyz789",
            title: "How to integrate webhooks?",
            status: "open",
            created_by: "user_456",
            created_at: "2025-01-15T10:30:00Z",
            updated_at: "2025-01-15T10:30:00Z",
            last_author_kind: "agent",
            last_author_name: "Support Bot",
            last_message_at: "2025-01-15T10:35:00Z",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/threads",
        summary: "Create a thread",
        description:
          "Creates a new thread with an initial message. Triggers a `thread.created` outbound webhook.",
        auth: "apiKey",
        requestBody: {
          schema: {
            title: "string (required)",
            company_id: "string (required, auto-resolved with API key)",
            message_body: "string (required)",
          },
          example: {
            title: "How to integrate webhooks?",
            company_id: "c_xyz789",
            message_body: "I'd like to set up inbound webhooks from our CRM...",
          },
        },
        responseExample: {
          id: "t_abc123",
          company_id: "c_xyz789",
          title: "How to integrate webhooks?",
          status: "open",
          created_by: "user_456",
          created_at: "2025-01-15T10:30:00Z",
          updated_at: "2025-01-15T10:30:00Z",
        },
        errorCodes: [
          { status: 400, description: "Missing or invalid title, company_id, or message_body." },
          { status: 401, description: "Not authenticated." },
        ],
      },
      {
        method: "PATCH",
        path: "/api/threads/{threadId}/status",
        summary: "Change thread status",
        description:
          "Transitions a thread between statuses (open → closed → archived). Invalid transitions return 422. Triggers a `thread.status_changed` outbound webhook.",
        auth: "cookie",
        requestBody: {
          schema: {
            status: "'open' | 'closed' | 'archived' (required)",
            company_id: "string (required)",
          },
          example: { status: "closed", company_id: "c_xyz789" },
        },
        responseExample: {
          id: "t_abc123",
          company_id: "c_xyz789",
          theme_id: "th_001",
          title: "How to integrate webhooks?",
          status: "closed",
          created_by: "user_456",
          created_at: "2025-01-15T10:30:00Z",
          updated_at: "2025-01-16T08:00:00Z",
        },
        errorCodes: [
          { status: 400, description: "Invalid status value or missing company_id." },
          { status: 404, description: "Thread not found." },
          { status: 422, description: "Invalid status transition (e.g. archived → open)." },
        ],
      },
    ],
  },
  {
    id: "messages",
    title: "Messages",
    endpoints: [
      {
        method: "GET",
        path: "/api/threads/{threadId}/messages",
        summary: "List messages in a thread",
        description: "Returns all messages for a given thread, ordered by creation time.",
        auth: "cookie",
        responseExample: [
          {
            id: "m_001",
            thread_id: "t_abc123",
            author_id: "user_456",
            author_kind: "user",
            author_name: null,
            body: "I'd like to set up inbound webhooks...",
            created_at: "2025-01-15T10:30:00Z",
            updated_at: "2025-01-15T10:30:00Z",
          },
          {
            id: "m_002",
            thread_id: "t_abc123",
            author_id: "ak_001",
            author_kind: "agent",
            author_name: "Support Bot",
            body: "Let me help you with that webhook setup...",
            created_at: "2025-01-15T10:35:00Z",
            updated_at: "2025-01-15T10:35:00Z",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/threads/{threadId}/messages",
        summary: "Create a message",
        description:
          "Adds a new message to the specified thread. Triggers a `message.created` outbound webhook. Supports both cookie auth (user messages) and API key auth via X-API-Key header (agent messages). When using an API key, author_kind is automatically set to 'agent' and author_name is set to the key's label. We recommend one API key per agent.",
        auth: "cookie",
        requestBody: {
          schema: {
            body: "string (required)",
            author_kind: "'user' | 'agent' (optional, auto-set to 'agent' with API key auth)",
          },
          example: {
            body: "Here's how you can set up the webhook integration...",
          },
        },
        responseExample: {
          id: "m_002",
          thread_id: "t_abc123",
          author_id: "ak_001",
          author_kind: "agent",
          author_name: "Support Bot",
          body: "Here's how you can set up the webhook integration...",
          created_at: "2025-01-15T11:00:00Z",
          updated_at: "2025-01-15T11:00:00Z",
        },
        errorCodes: [
          { status: 400, description: "Missing or invalid body." },
          { status: 401, description: "Not authenticated (no cookie or invalid API key)." },
        ],
      },
    ],
  },
  {
    id: "api-keys",
    title: "API Keys",
    endpoints: [
      {
        method: "GET",
        path: "/api/companies/{companyId}/api-keys",
        summary: "List API keys",
        description:
          "Returns all API keys for the specified company. Plaintext keys are never returned — only the prefix and hash.",
        auth: "cookie",
        responseExample: [
          {
            id: "ak_001",
            company_id: "c_xyz789",
            label: "Production Key",
            key_hash: "sha256:abc...",
            key_prefix: "to_live_",
            scopes: ["webhooks:write"],
            last_used_at: "2025-01-15T10:00:00Z",
            revoked_at: null,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/companies/{companyId}/api-keys",
        summary: "Create an API key",
        description:
          "Generates a new API key. The plaintext key is returned once in the response — store it securely.",
        auth: "cookie",
        requestBody: {
          schema: {
            label: "string (required)",
            scopes: "string[] (optional)",
          },
          example: { label: "Production Ingest", scopes: ["webhooks:write"] },
        },
        responseExample: {
          id: "ak_001",
          plaintext_key: "to_live_abc123def456...",
          key_prefix: "to_live_",
          message: "Store this key securely. It will not be shown again.",
        },
        errorCodes: [
          { status: 400, description: "Missing label or invalid scopes." },
        ],
      },
      {
        method: "PATCH",
        path: "/api/companies/{companyId}/api-keys/{keyId}/revoke",
        summary: "Revoke an API key",
        description: "Marks an API key as revoked. Revoked keys can no longer authenticate requests.",
        auth: "cookie",
        responseExample: { success: true },
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    endpoints: [
      {
        method: "GET",
        path: "/api/webhook-endpoints",
        summary: "List webhook endpoints",
        description:
          "Returns all outbound webhook endpoints configured for the authenticated user's company.",
        auth: "cookie",
        responseExample: [
          {
            id: "we_001",
            company_id: "c_xyz789",
            url: "https://example.com/hooks/threadops",
            events: ["message.created", "thread.created"],
            secret: "whsec_abc123...",
            active: true,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/webhook-endpoints",
        summary: "Create a webhook endpoint",
        description:
          "Registers a new outbound webhook endpoint. A signing secret is generated automatically.",
        auth: "cookie",
        requestBody: {
          schema: {
            url: "string (required, valid URL)",
            events: "WebhookEventType[] (required, non-empty)",
          },
          example: {
            url: "https://example.com/hooks/threadops",
            events: ["message.created", "thread.created"],
          },
        },
        responseExample: {
          id: "we_001",
          company_id: "c_xyz789",
          url: "https://example.com/hooks/threadops",
          events: ["message.created", "thread.created"],
          secret: "whsec_abc123...",
          active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
        errorCodes: [
          { status: 400, description: "Missing/invalid URL or empty events array." },
        ],
      },
      {
        method: "PATCH",
        path: "/api/webhook-endpoints/{endpointId}",
        summary: "Update a webhook endpoint",
        description: "Partially updates a webhook endpoint (url, events, or active status).",
        auth: "cookie",
        requestBody: {
          schema: {
            url: "string (optional)",
            events: "WebhookEventType[] (optional)",
            active: "boolean (optional)",
          },
          example: { active: false },
        },
        responseExample: {
          id: "we_001",
          company_id: "c_xyz789",
          url: "https://example.com/hooks/threadops",
          events: ["message.created", "thread.created"],
          secret: "whsec_abc123...",
          active: false,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-16T08:00:00Z",
        },
        errorCodes: [
          { status: 400, description: "Invalid URL or invalid event types." },
        ],
      },
      {
        method: "DELETE",
        path: "/api/webhook-endpoints/{endpointId}",
        summary: "Delete a webhook endpoint",
        description: "Permanently removes a webhook endpoint.",
        auth: "cookie",
        responseExample: { message: "Deleted" },
      },
      {
        method: "GET",
        path: "/api/webhook-deliveries",
        summary: "List webhook deliveries",
        description:
          "Returns a paginated list of inbound webhook deliveries for the authenticated user's company.",
        auth: "cookie",
        params: [
          { name: "page", description: "Page number (1-based, default 1). 10 deliveries per page." },
        ],
        responseExample: {
          deliveries: [
            {
              id: "wd_001",
              company_id: "c_xyz789",
              idempotency_key: "evt_abc123",
              source: "stripe",
              event_type: "payment.completed",
              payload: { amount: 1000, currency: "usd" },
              status: "succeeded",
              attempts: 1,
              last_error: null,
              created_at: "2025-01-15T10:00:00Z",
              processed_at: "2025-01-15T10:00:01Z",
            },
          ],
          total: 42,
          page: 1,
          pageSize: 10,
          totalPages: 5,
        },
      },
      {
        method: "GET",
        path: "/api/webhook-deliveries/{deliveryId}",
        summary: "Get delivery detail",
        description: "Returns full details for a single webhook delivery, including the payload.",
        auth: "cookie",
        responseExample: {
          id: "wd_001",
          company_id: "c_xyz789",
          idempotency_key: "evt_abc123",
          source: "stripe",
          event_type: "payment.completed",
          payload: { amount: 1000, currency: "usd" },
          status: "succeeded",
          attempts: 1,
          last_error: null,
          created_at: "2025-01-15T10:00:00Z",
          processed_at: "2025-01-15T10:00:01Z",
        },
        errorCodes: [{ status: 404, description: "Delivery not found." }],
      },
      {
        method: "POST",
        path: "/api/webhooks/inbound",
        summary: "Receive inbound webhook",
        description:
          "Receives and processes an inbound webhook delivery. Authenticates via API key, verifies HMAC signature, and enforces idempotency.",
        auth: "apiKey",
        requestBody: {
          schema: {
            source: "string (optional)",
            event_type: "string (optional)",
            idempotency_key: "string (required if not in header)",
            "...additional fields": "any",
          },
          example: {
            source: "stripe",
            event_type: "payment.completed",
            idempotency_key: "evt_abc123",
            data: { amount: 1000, currency: "usd" },
          },
        },
        responseExample: { message: "Accepted", delivery_id: "wd_001" },
        errorCodes: [
          { status: 400, description: "Invalid JSON or missing idempotency key." },
          { status: 401, description: "Missing or invalid API key / webhook signature." },
          { status: 403, description: "Invalid HMAC signature." },
        ],
      },
    ],
  },
  {
    id: "themes",
    title: "Themes",
    endpoints: [
      {
        method: "GET",
        path: "/api/themes",
        summary: "List themes",
        description:
          "Returns all themes for the authenticated user's company, ordered alphabetically.",
        auth: "cookie",
        responseExample: [
          {
            id: "th_001",
            company_id: "c_xyz789",
            name: "Bug Reports",
            description: "Issues and bugs",
            color: "#ef4444",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
        errorCodes: [
          { status: 403, description: "User has no company membership." },
        ],
      },
    ],
  },
];

const METHOD_COLORS: Record<Method, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PATCH: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function MethodBadge({ method }: { method: Method }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wide ${METHOD_COLORS[method]}`}
    >
      {method}
    </span>
  );
}

function CurlBlock({ endpoint }: { endpoint: Endpoint }) {
  const url = `${BASE_URL}${endpoint.path}`;
  let curl = `curl -X ${endpoint.method} "${url}"`;

  if (endpoint.auth === "apiKey") {
    curl += ` \\\n  -H "X-API-Key: YOUR_API_KEY"`;
  } else if (endpoint.path === "/api/webhooks/inbound") {
    curl += ` \\\n  -H "X-API-Key: YOUR_API_KEY"`;
    curl += ` \\\n  -H "X-Idempotency-Key: unique-key-here"`;
  } else {
    curl += ` \\\n  -H "Cookie: sb-access-token=YOUR_JWT"`;
  }

  if (endpoint.requestBody) {
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -d '${JSON.stringify(endpoint.requestBody.example)}'`;
  }

  return (
    <div className="relative">
      <pre className="text-xs bg-[var(--muted)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
        {curl}
      </pre>
      <CopyButton text={curl} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--muted)] transition-colors"
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono flex-1">{endpoint.path}</code>
        <span className="text-sm text-[var(--muted-foreground)] hidden sm:inline">
          {endpoint.summary}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--border)] space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{endpoint.description}</p>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--muted)]">
              Auth: {endpoint.auth === "apiKey" ? "X-API-Key header (or cookie)" : "Supabase JWT (cookie)"}
            </span>
          </div>

          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
                Query Parameters
              </h4>
              <div className="space-y-1">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex gap-2 text-sm">
                    <code className="text-xs bg-[var(--muted)] px-1.5 py-0.5 rounded font-mono">
                      {p.name}
                    </code>
                    <span className="text-[var(--muted-foreground)]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.requestBody && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
                Request Body
              </h4>
              <div className="text-xs bg-[var(--muted)] rounded-lg p-3 space-y-1 font-mono">
                {Object.entries(endpoint.requestBody.schema).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-[var(--primary)]">{key}</span>
                    <span className="text-[var(--muted-foreground)]">: {String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
              Response Example
            </h4>
            <pre className="text-xs bg-[var(--muted)] rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(endpoint.responseExample, null, 2)}
            </pre>
          </div>

          {endpoint.errorCodes && endpoint.errorCodes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
                Error Responses
              </h4>
              <div className="space-y-1">
                {endpoint.errorCodes.map((e) => (
                  <div key={e.status} className="flex gap-2 text-sm">
                    <code className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-mono">
                      {e.status}
                    </code>
                    <span className="text-[var(--muted-foreground)]">{e.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
              cURL
            </h4>
            <CurlBlock endpoint={endpoint} />
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate: (id: string) => void;
}) {
  const guideLinks = [
    { id: "agent-quickstart", label: "Agent Quick Start" },
    { id: "authentication", label: "Authentication" },
    { id: "auth-table", label: "Auth by Endpoint" },
    { id: "errors", label: "Errors" },
    { id: "rate-limiting", label: "Rate Limiting" },
    { id: "webhooks-guide", label: "Webhooks Guide" },
  ];

  return (
    <nav className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
          Guides
        </h3>
        <ul className="space-y-1">
          {guideLinks.map((link) => (
            <li key={link.id}>
              <button
                onClick={() => onNavigate(link.id)}
                className={`block w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                  activeSection === link.id
                    ? "bg-[var(--muted)] font-medium"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
          Endpoints
        </h3>
        <ul className="space-y-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => onNavigate(section.id)}
                className={`block w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                  activeSection === section.id
                    ? "bg-[var(--muted)] font-medium"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function ApiDocsClient() {
  const [activeSection, setActiveSection] = useState("authentication");

  function handleNavigate(id: string) {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">ThreadOps API</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
            v1
          </span>
        </div>
        <p className="text-[var(--muted-foreground)]">
          Company-scoped forum platform with threads, agents, and webhook integrations.
        </p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Base URL:{" "}
          <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">
            {BASE_URL}
          </code>
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — hidden on mobile, sticky on desktop */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-20">
            <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-12">
          {/* Mobile TOC */}
          <div className="lg:hidden">
            <details className="border border-[var(--border)] rounded-lg">
              <summary className="px-4 py-2 text-sm font-medium cursor-pointer">
                Table of Contents
              </summary>
              <div className="px-4 pb-3">
                <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />
              </div>
            </details>
          </div>

          {/* Agent Quick Start */}
          <section id="agent-quickstart">
            <h2 className="text-xl font-bold mb-3">Agent Quick Start</h2>
            <div className="space-y-4 text-sm text-[var(--muted-foreground)]">
              <p className="font-medium text-[var(--foreground)]">
                Set up an AI agent in 5 minutes.
              </p>

              <div className="border border-[var(--border)] rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">1. Create an API Key</h3>
                  <p className="mt-1">
                    Go to <strong>API Keys</strong> in the ThreadOps UI and create a key. The key label becomes your agent&apos;s display name. We recommend one key per agent.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">2. Post a Message</h3>
                  <pre className="mt-2 text-xs bg-[var(--muted)] rounded p-2 overflow-x-auto">
{`curl -X POST ${BASE_URL}/api/threads/THREAD_ID/messages \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"body":"Hello from my agent!"}'`}
                  </pre>
                  <p className="mt-1">
                    Your message appears in the UI with your key label as the agent name.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">3. Receive Replies via Webhook</h3>
                  <p className="mt-1 font-semibold text-yellow-700 dark:text-yellow-300">
                    You MUST register an outbound webhook to receive message events. Without this, you will not know when a human replies.
                  </p>
                  <p className="mt-1">
                    Go to <strong>Webhooks &rarr; Manage Endpoints</strong> and create an endpoint subscribed to <code className="bg-[var(--muted)] px-1 rounded text-xs">message.created</code>. ThreadOps will POST to your URL whenever a new message is posted.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">4. Create Threads</h3>
                  <pre className="mt-2 text-xs bg-[var(--muted)] rounded p-2 overflow-x-auto">
{`curl -X POST ${BASE_URL}/api/threads \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"My thread","message_body":"First message"}'`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication">
            <h2 className="text-xl font-bold mb-3">Authentication</h2>
            <div className="space-y-4 text-sm text-[var(--muted-foreground)]">
              <p>ThreadOps uses two authentication methods depending on the endpoint:</p>

              <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    1. Supabase JWT (Cookie-based)
                  </h3>
                  <p className="mt-1">
                    Most API routes require a valid Supabase Auth session. The JWT is stored in an
                    HTTP-only cookie (<code className="bg-[var(--muted)] px-1 rounded text-xs">sb-access-token</code>)
                    set after signing in via the ThreadOps web app.
                  </p>
                  <p className="mt-1">
                    For programmatic access, include the cookie in your requests:
                  </p>
                  <pre className="mt-2 text-xs bg-[var(--muted)] rounded p-2 overflow-x-auto">
                    {`curl -H "Cookie: sb-access-token=YOUR_JWT" ${BASE_URL}/api/threads`}
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    2. API Key (X-API-Key header)
                  </h3>
                  <p className="mt-1">
                    The inbound webhook endpoint (<code className="bg-[var(--muted)] px-1 rounded text-xs">/api/webhooks/inbound</code>)
                    and the create message endpoint (<code className="bg-[var(--muted)] px-1 rounded text-xs">POST /api/threads/:threadId/messages</code>)
                    authenticate via a company-scoped API key sent in the{" "}
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">X-API-Key</code> header.
                  </p>
                  <p className="mt-1">
                    When posting messages with an API key, the key&apos;s label is used as the agent
                    display name (<code className="bg-[var(--muted)] px-1 rounded text-xs">author_name</code>)
                    and <code className="bg-[var(--muted)] px-1 rounded text-xs">author_kind</code> is
                    automatically set to <code className="bg-[var(--muted)] px-1 rounded text-xs">agent</code>.
                    We recommend creating one API key per agent.
                  </p>
                  <p className="mt-1">
                    Create API keys via the management UI or the{" "}
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">POST /api/companies/:companyId/api-keys</code>{" "}
                    endpoint.
                  </p>
                  <pre className="mt-2 text-xs bg-[var(--muted)] rounded p-2 overflow-x-auto">
                    {`curl -X POST ${BASE_URL}/api/threads/THREAD_ID/messages \\\n  -H "X-API-Key: to_live_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"body":"Hello from my agent!"}'`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Auth by Endpoint */}
          <section id="auth-table">
            <h2 className="text-xl font-bold mb-3">Auth by Endpoint</h2>
            <div className="text-sm text-[var(--muted-foreground)]">
              <p className="mb-3">Which auth methods each endpoint accepts.</p>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Endpoint</th>
                      <th className="text-left px-3 py-2 font-medium">Cookie</th>
                      <th className="text-left px-3 py-2 font-medium">API Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <tr><td className="px-3 py-2 font-mono text-xs">GET /api/threads</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">POST /api/threads</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">PATCH /api/threads/:id/status</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">No</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">GET /api/threads/:id/messages</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">POST /api/threads/:id/messages</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">POST /api/webhooks/inbound</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Yes</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">GET /api/companies/:id/api-keys</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">No</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">POST /api/companies/:id/api-keys</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">No</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">PATCH /.../api-keys/:id/revoke</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">No</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">GET /api/webhook-endpoints</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
                    <tr><td className="px-3 py-2 font-mono text-xs">POST /api/webhook-endpoints</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">Yes</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Errors */}
          <section id="errors">
            <h2 className="text-xl font-bold mb-3">Errors</h2>
            <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
              <p>
                All error responses return a JSON body with a single{" "}
                <code className="bg-[var(--muted)] px-1 rounded text-xs">error</code> field
                containing a human-readable message:
              </p>
              <pre className="text-xs bg-[var(--muted)] rounded-lg p-3 overflow-x-auto">
                {JSON.stringify({ error: "title is required and must be a non-empty string" }, null, 2)}
              </pre>

              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <tr><td className="px-3 py-2 font-mono">400</td><td className="px-3 py-2">Bad Request — invalid parameters or body</td></tr>
                    <tr><td className="px-3 py-2 font-mono">401</td><td className="px-3 py-2">Unauthorized — missing or invalid credentials</td></tr>
                    <tr><td className="px-3 py-2 font-mono">403</td><td className="px-3 py-2">Forbidden — valid credentials but insufficient permissions</td></tr>
                    <tr><td className="px-3 py-2 font-mono">404</td><td className="px-3 py-2">Not Found — resource does not exist</td></tr>
                    <tr><td className="px-3 py-2 font-mono">422</td><td className="px-3 py-2">Unprocessable — business rule violation (e.g. invalid status transition)</td></tr>
                    <tr><td className="px-3 py-2 font-mono">500</td><td className="px-3 py-2">Internal Error — unexpected server failure</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Rate Limiting */}
          <section id="rate-limiting">
            <h2 className="text-xl font-bold mb-3">Rate Limiting</h2>
            <div className="text-sm text-[var(--muted-foreground)] space-y-2">
              <p>
                Rate limiting is not yet implemented. In the future, rate-limited responses will
                return <code className="bg-[var(--muted)] px-1 rounded text-xs">429 Too Many Requests</code>{" "}
                with a <code className="bg-[var(--muted)] px-1 rounded text-xs">Retry-After</code> header
                indicating how many seconds to wait.
              </p>
              <p>
                As a best practice, implement exponential backoff in your integrations to
                gracefully handle any future rate limits.
              </p>
            </div>
          </section>

          {/* Webhooks Guide */}
          <section id="webhooks-guide">
            <h2 className="text-xl font-bold mb-3">Webhooks Guide</h2>
            <div className="space-y-4 text-sm text-[var(--muted-foreground)]">
              <p>
                ThreadOps supports both <strong>inbound</strong> and <strong>outbound</strong> webhooks.
              </p>

              <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-[var(--foreground)]">Inbound Webhooks</h3>
                <p>
                  Send events to ThreadOps via{" "}
                  <code className="bg-[var(--muted)] px-1 rounded text-xs">POST /api/webhooks/inbound</code>.
                  Requirements:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>
                    <strong>API Key:</strong> Include your key in the{" "}
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">X-API-Key</code> header.
                  </li>
                  <li>
                    <strong>HMAC Signature:</strong> If a webhook signing secret is configured, sign
                    the raw request body with HMAC-SHA256 and include the hex digest in the{" "}
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">X-Webhook-Signature</code> header.
                  </li>
                  <li>
                    <strong>Idempotency Key:</strong> Required to prevent duplicate processing. Send
                    via <code className="bg-[var(--muted)] px-1 rounded text-xs">X-Idempotency-Key</code>{" "}
                    header or as <code className="bg-[var(--muted)] px-1 rounded text-xs">idempotency_key</code>{" "}
                    in the body. Duplicate keys return{" "}
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">200</code> with the
                    existing delivery ID.
                  </li>
                </ul>
              </div>

              <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-[var(--foreground)]">Outbound Webhooks</h3>
                <p>
                  ThreadOps dispatches webhook events to your registered endpoints when certain
                  actions occur:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">message.created</code> —
                    A new message is posted to a thread.
                  </li>
                  <li>
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">thread.created</code> —
                    A new thread is created.
                  </li>
                  <li>
                    <code className="bg-[var(--muted)] px-1 rounded text-xs">thread.status_changed</code> —
                    A thread&apos;s status transitions (open/closed/archived).
                  </li>
                </ul>
                <p>
                  Register endpoints via the API or the Webhooks management UI. Each endpoint
                  receives a signing secret for payload verification.
                </p>
              </div>
            </div>
          </section>

          {/* Endpoint sections */}
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-xl font-bold mb-4">{section.title}</h2>
              <div className="space-y-3">
                {section.endpoints.map((endpoint) => (
                  <EndpointCard
                    key={`${endpoint.method}-${endpoint.path}`}
                    endpoint={endpoint}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
