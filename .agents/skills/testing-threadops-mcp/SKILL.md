---
name: testing-threadops-mcp
description: Test ThreadOps MCP server end-to-end via stdio transport. Use when verifying MCP tool implementations, API key auth, agent-scoped operations, or cross-company isolation.
---

## Overview

The ThreadOps MCP server lives at `src/mcp/server.ts` and uses stdio transport (JSON-RPC 2.0 with Content-Length framing). Testing is shell-based — no browser recording needed.

## Devin Secrets Needed

- `THREADOPS_SUPABASE_SECRET_KEY` — Supabase service role key (used as `SUPABASE_SERVICE_ROLE_KEY`)
- The anon key and project URL can be retrieved via Supabase MCP (`get_publishable_keys` for project `gymsbxkuiknbdtulmopv`)

## Environment Setup

### .env.local
```bash
cd /home/ubuntu/repos/threadops
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://gymsbxkuiknbdtulmopv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<value of THREADOPS_SUPABASE_SECRET_KEY>
EOF
```

### Create a Test API Key
The MCP server authenticates via `THREADOPS_API_KEY` env var. Create a fresh API key in the database:

```bash
cd /home/ubuntu/repos/threadops

# Generate plaintext key + SHA-256 hash
KEY_DATA=$(node -e "
const c = require('crypto');
const p = 'to_mcp_test_key_' + c.randomBytes(16).toString('hex');
const h = c.createHash('sha256').update(p).digest('hex');
console.log(JSON.stringify({ plaintext: p, hash: h, prefix: p.substring(0, 8) }));
")
echo "$KEY_DATA"

# Insert via Supabase REST API
source .env.local
PLAINTEXT=$(echo "$KEY_DATA" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).plaintext)")
HASH=$(echo "$KEY_DATA" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).hash)")
PREFIX=$(echo "$KEY_DATA" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).prefix)")

curl -s -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/api_keys" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"company_id\":\"a0000000-0000-0000-0000-000000000001\",\"label\":\"MCP-Test-Bot\",\"key_hash\":\"$HASH\",\"key_prefix\":\"$PREFIX\",\"scopes\":[\"threads:read\",\"threads:write\",\"messages:read\",\"messages:write\",\"webhooks:read\"]}"

export THREADOPS_API_KEY="$PLAINTEXT"
```

## Testing the MCP Server

### Recommended: Use the MCP SDK Client
The most reliable way to test is with the official SDK's `Client` + `StdioClientTransport`. A hand-rolled JSON-RPC client over stdin/stdout may have buffering issues with `npx tsx`.

```javascript
// mcp-test-sdk.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/mcp/server.ts"],
  env: { ...process.env, THREADOPS_API_KEY: process.env.THREADOPS_API_KEY },
});
const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

// Call tools
const res = await client.callTool({ name: "list_threads", arguments: {} });
console.log(res.content[0].text);

await client.close();
```

### Important: Do NOT use raw stdin/stdout piping
Spawning `npx tsx` and writing raw `Content-Length: ...\r\n\r\n{...}` to stdin does NOT work reliably due to node/npx process buffering. Always use `StdioClientTransport` from the SDK.

## Key Behaviors to Test

### Agent-Scoped Thread Listing
`list_threads` filters by `agent_api_key_id` (not just `company_id`). Each agent only sees threads it created. A fresh API key starts with 0 threads.

### Cross-Company Isolation
Attempting to access a thread from another company returns `isError: true` with "Thread not found or does not belong to your company". Use thread ID `f0000000-0000-0000-0000-000000000002` (Other Corp).

### Auth Caching
API key auth is validated once on first tool call and cached for the MCP server's lifetime. Revoking a key won't take effect until the MCP process restarts.

### Invalid API Key
Setting `THREADOPS_API_KEY` to an invalid value produces `isError: true, "Invalid API key"` on any tool call.

### OAuth Access Token Auth (authorization_code flow)
The MCP auth middleware (`src/mcp/auth.ts`) accepts two token formats:
- Direct API key (prefix `to_`) → validated via `api_keys` table hash lookup
- OAuth access token (prefix `to_at_`) → resolved via `oauth_access_tokens` table → linked `api_keys` record

To test OAuth token auth, you need a valid `to_at_` token in the `oauth_access_tokens` table. This requires the `033_oauth_authorization_codes.sql` migration to be applied. Without it, `to_at_` tokens will always fail with "Invalid access token".

### Webhook Auto-Events
`register_webhook` automatically includes `docs.updated` and `action.requested` events in addition to what was requested.

### Status Values
Thread status is `"open"` or `"archived"` (no "closed" status).

## Tool List (as of PR #29+)
12 tools: list_threads, create_thread, get_messages, post_message, update_thread_status, register_webhook, list_webhooks, search, update_thread_tags, update_thread_metadata, update_thread_summary, list_thread_summaries

## No Recording Needed
MCP server testing is entirely shell-based (stdio transport). There is no browser UI to record.
