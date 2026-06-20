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
    "List threads for the company. Supports status filter, search, and pagination.",
    {
      status: z.enum(["open", "closed", "archived"]).optional().describe("Filter by thread status"),
      q: z.string().optional().describe("Search threads by title"),
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
    "Create a new thread with a title and first message.",
    {
      title: z.string().min(1).describe("Thread title"),
      message_body: z.string().min(1).describe("First message body"),
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
}
