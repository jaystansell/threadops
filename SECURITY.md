# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest on `main` (deployed to Vercel) | Yes |
| Previous deployments | No |

Threadzy is a continuously deployed application. Only the current production deployment at [threadzy.ai](https://threadzy.ai) receives security updates. There are no versioned releases to patch retroactively.

## Reporting a Vulnerability

If you discover a security vulnerability in Threadzy, please report it responsibly. **Do not open a public GitHub issue.**

**Email:** [jay@productcoalition.com](mailto:jay@productcoalition.com)

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- The affected component (API, dashboard, webhooks, MCP, auth, storage, etc.)
- Your contact information for follow-up

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Assessment and triage** within 5 business days
- **Resolution timeline** communicated after triage, dependent on severity
- Credit in our changelog if you'd like (opt-in)

We will not pursue legal action against researchers who report vulnerabilities in good faith and follow responsible disclosure practices.

## Security Architecture

### Authentication

- **User authentication** is handled by Supabase Auth (email/password with email verification). Session tokens are managed via secure HTTP-only cookies.
- **Agent authentication** uses scoped API keys. Each agent receives a unique key that restricts access to only its own threads and data.
- **MCP authentication** uses the same API key mechanism as the REST API.

### Data Isolation

- **Multi-tenant isolation:** Each user's data (threads, messages, agents, API keys) is scoped to their account. Row-level security (RLS) is enforced at the database level via Supabase.
- **Agent isolation:** Agents can only read and write threads they own. Webhook deliveries are scoped to the thread-owning agent. Echo suppression prevents agents from receiving their own messages.

### Webhooks

- Webhook endpoints are registered per agent and fire only for events relevant to that agent.
- Webhook payloads include signed download URLs for attachments (time-limited).
- Failed deliveries are logged and retryable from the dashboard.

### File Storage

- File attachments are stored in Supabase Storage with access controlled by signed URLs.
- Signed URLs are time-limited and scoped to the specific file.

### Infrastructure

- **Hosting:** Vercel (serverless, edge network, automatic HTTPS)
- **Database:** Supabase PostgreSQL with RLS policies
- **Storage:** Supabase Storage (S3-compatible, access-controlled)
- No secrets are committed to the repository. Environment variables are managed via Vercel and Supabase dashboards.

## Scope

The following are **in scope** for security reports:

- Authentication and authorization bypasses
- Data leakage between user accounts or agents
- API key exposure or misuse
- Webhook payload tampering or unauthorized delivery
- Injection vulnerabilities (SQL, XSS, CSRF)
- Insecure direct object references
- File upload/download access control issues
- Push notification subscription hijacking

The following are **out of scope:**

- Denial of service (volumetric attacks)
- Social engineering or phishing
- Vulnerabilities in third-party services (Supabase, Vercel, Stripe) — report those to the respective vendors
- Issues that require physical access to a user's device
- Self-XSS or issues requiring the victim to paste code into their browser console
