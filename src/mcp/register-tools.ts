import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SupabaseClient } from "../adapters/supabase/client";
import type { AuthContext } from "./auth";
import { listThreads } from "./tools/list-threads";
import { createThread } from "./tools/create-thread";
import { getMessages } from "./tools/get-messages";
import { postMessage } from "./tools/post-message";
import { updateThreadStatus } from "./tools/update-thread-status";
import { registerWebhook } from "./tools/register-webhook";
import { listWebhooks } from "./tools/list-webhooks";
import { search } from "./tools/search";
import { updateThreadTags } from "./tools/update-thread-tags";
import { updateThreadMetadata } from "./tools/update-thread-metadata";
import { updateThreadSummary } from "./tools/update-thread-summary";
import { listThreadSummaries } from "./tools/list-thread-summaries";

function toolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function toolError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerTools(
  server: McpServer,
  db: SupabaseClient,
  getAuth: () => Promise<AuthContext>,
) {
  server.tool(
    "list_threads",
    "List threads for the company. Supports status filter, search, tag filter, metadata filter, and pagination.",
    {
      status: z.enum(["open", "closed", "archived"]).optional().describe("Filter by thread status"),
      q: z.string().optional().describe("Search threads by title"),
      tags: z.array(z.string()).optional().describe("Filter by tags (AND logic — thread must have all specified tags)"),
      metadata_filter: z.record(z.string(), z.string()).optional().describe("Filter by metadata key-value pairs"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (1-200, default 100)"),
      offset: z.number().int().min(0).optional().describe("Pagination offset"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await listThreads(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "create_thread",
    "Create a new thread with a title and first message. Optionally add tags.",
    {
      title: z.string().min(1).describe("Thread title"),
      message_body: z.string().min(1).describe("First message body"),
      tags: z.array(z.string()).optional().describe("Optional tags to add to the thread"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await createThread(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "get_messages",
    "Get all messages for a thread.",
    {
      thread_id: z.string().describe("Thread ID"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await getMessages(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "post_message",
    "Post a message to a thread. The agent identity comes from the API key label.",
    {
      thread_id: z.string().describe("Thread ID"),
      body: z.string().min(1).describe("Message body"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await postMessage(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "update_thread_status",
    "Change a thread's status to open, closed, or archived.",
    {
      thread_id: z.string().describe("Thread ID"),
      status: z.enum(["open", "closed", "archived"]).describe("New status"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await updateThreadStatus(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "register_webhook",
    "Register a webhook endpoint to receive events (message.created, thread.created, thread.status_changed).",
    {
      url: z.string().url().describe("Webhook endpoint URL"),
      events: z
        .array(z.enum(["message.created", "thread.created", "thread.status_changed", "docs.updated"]))
        .min(1)
        .describe("Events to subscribe to. Note: docs.updated is always included automatically."),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await registerWebhook(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_webhooks",
    "List registered webhook endpoints for the company.",
    {},
    async () => {
      try {
        const auth = await getAuth();
        const data = await listWebhooks(db, auth);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "search",
    "Full-text search across threads and messages.",
    {
      query: z.string().min(1).describe("Search query text"),
      scope: z.enum(["messages", "threads", "all"]).optional().describe("Scope: messages, threads, or all (default: all)"),
      filters: z.object({
        status: z.string().optional().describe("Filter by thread status"),
        author_kind: z.string().optional().describe("Filter messages by author kind (user or agent)"),
        created_after: z.string().optional().describe("ISO date — only results after this date"),
        created_before: z.string().optional().describe("ISO date — only results before this date"),
      }).optional().describe("Optional filters"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await search(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "update_thread_tags",
    "Add or remove tags from a thread.",
    {
      thread_id: z.string().describe("Thread ID"),
      add: z.array(z.string()).optional().describe("Tags to add"),
      remove: z.array(z.string()).optional().describe("Tags to remove"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await updateThreadTags(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "update_thread_metadata",
    "Update thread metadata with merge semantics. Set keys and/or unset keys.",
    {
      thread_id: z.string().describe("Thread ID"),
      set: z.record(z.string(), z.unknown()).optional().describe("Key-value pairs to set/merge into metadata"),
      unset: z.array(z.string()).optional().describe("Keys to remove from metadata"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await updateThreadMetadata(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "update_thread_summary",
    "Set or update the summary for a thread. Each update is appended to the summary log for history.",
    {
      thread_id: z.string().describe("Thread ID"),
      summary: z.string().describe("Summary text for the thread"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await updateThreadSummary(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    "list_thread_summaries",
    "List the summary history log for a thread. Returns all past summaries ordered newest first.",
    {
      thread_id: z.string().describe("Thread ID"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50)"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        const data = await listThreadSummaries(db, auth, args);
        return toolResult(data);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
