import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SupabaseClient } from "../adapters/supabase/client";
import { logThreadRead } from "../adapters/supabase/usage-log-repo";
import type { ApiKeyId, CompanyId } from "../core/types";
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
  // Tool 1: manage_threads — list, create, update status, search
  server.tool(
    "manage_threads",
    "Manage threads: list, create, update status, or search. Set action to choose the operation.",
    {
      action: z.enum(["list", "create", "update_status", "search"]).describe(
        "Operation: list (browse threads), create (new thread), update_status (open/archive), search (full-text)",
      ),
      // list params
      status: z.enum(["open", "archived"]).optional().describe("[list] Filter by status"),
      q: z.string().optional().describe("[list] Search by title"),
      tags: z.array(z.string()).optional().describe("[list/create] Filter by or assign tags"),
      metadata_filter: z.record(z.string(), z.string()).optional().describe("[list] Filter by metadata key-value pairs"),
      limit: z.number().int().min(1).max(200).optional().describe("[list] Max results (default 100)"),
      offset: z.number().int().min(0).optional().describe("[list] Pagination offset"),
      // create params
      title: z.string().optional().describe("[create] Thread title (required for create)"),
      message_body: z.string().optional().describe("[create] First message body (required for create)"),
      // update_status params
      thread_id: z.string().optional().describe("[update_status] Thread ID (required for update_status)"),
      new_status: z.enum(["open", "archived"]).optional().describe("[update_status] New status (required for update_status)"),
      // search params
      query: z.string().optional().describe("[search] Search query text (required for search)"),
      scope: z.enum(["messages", "threads", "all"]).optional().describe("[search] Scope: messages, threads, or all (default: all)"),
      filters: z.object({
        status: z.string().optional(),
        author_kind: z.string().optional(),
        created_after: z.string().optional(),
        created_before: z.string().optional(),
      }).optional().describe("[search] Optional date/author/status filters"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        switch (args.action) {
          case "list":
            return toolResult(
              await listThreads(db, auth, {
                status: args.status,
                q: args.q,
                tags: args.tags,
                metadata_filter: args.metadata_filter,
                limit: args.limit,
                offset: args.offset,
              }),
            );
          case "create": {
            if (!args.title || !args.message_body) {
              return toolError("title and message_body are required for create");
            }
            return toolResult(
              await createThread(db, auth, {
                title: args.title,
                message_body: args.message_body,
                tags: args.tags,
              }),
            );
          }
          case "update_status": {
            if (!args.thread_id || !args.new_status) {
              return toolError("thread_id and new_status are required for update_status");
            }
            return toolResult(
              await updateThreadStatus(db, auth, {
                thread_id: args.thread_id,
                status: args.new_status,
              }),
            );
          }
          case "search": {
            if (!args.query) {
              return toolError("query is required for search");
            }
            return toolResult(
              await search(db, auth, {
                query: args.query,
                scope: args.scope,
                filters: args.filters,
              }),
            );
          }
        }
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Tool 2: manage_messages — read and post messages on a thread
  server.tool(
    "manage_messages",
    "Read or post messages on a thread. Set action to list (get all messages) or post (send a new message).",
    {
      action: z.enum(["list", "post"]).describe("Operation: list (read messages) or post (send message)"),
      thread_id: z.string().describe("Thread ID"),
      body: z.string().optional().describe("[post] Message body (required for post)"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        switch (args.action) {
          case "list": {
            const messages = await getMessages(db, auth, { thread_id: args.thread_id });
            const msgCount = Array.isArray(messages) ? messages.length : 0;
            if (msgCount > 0) {
              logThreadRead(db, {
                apiKeyId: auth.keyId as ApiKeyId,
                companyId: auth.companyId as CompanyId,
                threadId: args.thread_id,
                messageCount: msgCount,
                userAgent: null,
                storedModelTier: auth.apiKey.model_tier,
              }).catch(() => {});
            }
            return toolResult(messages);
          }
          case "post": {
            if (!args.body) {
              return toolError("body is required for post");
            }
            return toolResult(
              await postMessage(db, auth, {
                thread_id: args.thread_id,
                body: args.body,
              }),
            );
          }
        }
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Tool 3: manage_thread_context — summary, tags, and metadata for a thread
  server.tool(
    "manage_thread_context",
    "Manage a thread's context: update summary, view summary history, add/remove tags, or set/unset metadata.",
    {
      action: z.enum(["update_summary", "list_summaries", "update_tags", "update_metadata"]).describe(
        "Operation: update_summary, list_summaries, update_tags, or update_metadata",
      ),
      thread_id: z.string().describe("Thread ID"),
      // update_summary
      summary: z.string().optional().describe("[update_summary] New summary text"),
      // list_summaries
      limit: z.number().int().min(1).max(200).optional().describe("[list_summaries] Max results (default 50)"),
      // update_tags
      add: z.array(z.string()).optional().describe("[update_tags] Tags to add"),
      remove: z.array(z.string()).optional().describe("[update_tags] Tags to remove"),
      // update_metadata
      set: z.record(z.string(), z.unknown()).optional().describe("[update_metadata] Key-value pairs to set/merge"),
      unset: z.array(z.string()).optional().describe("[update_metadata] Keys to remove"),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        switch (args.action) {
          case "update_summary": {
            if (!args.summary) {
              return toolError("summary is required for update_summary");
            }
            return toolResult(
              await updateThreadSummary(db, auth, {
                thread_id: args.thread_id,
                summary: args.summary,
              }),
            );
          }
          case "list_summaries":
            return toolResult(
              await listThreadSummaries(db, auth, {
                thread_id: args.thread_id,
                limit: args.limit,
              }),
            );
          case "update_tags":
            return toolResult(
              await updateThreadTags(db, auth, {
                thread_id: args.thread_id,
                add: args.add,
                remove: args.remove,
              }),
            );
          case "update_metadata":
            return toolResult(
              await updateThreadMetadata(db, auth, {
                thread_id: args.thread_id,
                set: args.set,
                unset: args.unset,
              }),
            );
        }
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Tool 4: manage_webhooks — register and list webhook endpoints
  server.tool(
    "manage_webhooks",
    "Manage webhook endpoints: register a new endpoint or list existing ones.",
    {
      action: z.enum(["register", "list"]).describe("Operation: register (create endpoint) or list (view all)"),
      url: z.string().url().optional().describe("[register] Webhook endpoint URL (required for register)"),
      events: z
        .array(z.enum(["message.created", "thread.created", "thread.status_changed", "action.requested", "docs.updated"]))
        .optional()
        .describe("[register] Events to subscribe to (required for register). docs.updated is always included automatically."),
      filters: z
        .object({
          author_kind: z.enum(["user", "agent"]).optional().describe("Only deliver events matching this author type. Omit for all."),
        })
        .optional()
        .describe("[register] Optional filters to restrict which events are delivered (e.g., only human or agent messages)."),
    },
    async (args) => {
      try {
        const auth = await getAuth();
        switch (args.action) {
          case "register": {
            if (!args.url || !args.events || args.events.length === 0) {
              return toolError("url and events are required for register");
            }
            return toolResult(
              await registerWebhook(db, auth, {
                url: args.url,
                events: args.events,
                ...(args.filters && { filters: args.filters }),
              }),
            );
          }
          case "list":
            return toolResult(await listWebhooks(db, auth));
        }
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
