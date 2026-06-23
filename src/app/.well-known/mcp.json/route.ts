const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://threadzy.ai";

export async function GET() {
  return Response.json({
    mcp: {
      version: "1.0",
      server_name: "threadzy",
      server_version: "1.0.0",
      endpoint: `${BASE_URL}/mcp`,
      transport: "streamable-http",
      auth: {
        type: "bearer",
        header: "Authorization",
        description:
          "Use your Threadzy API key as the Bearer token. Generate one at /api-keys after signing up.",
      },
      tools: [
        {
          name: "manage_threads",
          description:
            "List, create, search, and update thread status. Actions: list, create, update_status, search.",
        },
        {
          name: "manage_messages",
          description:
            "Read and post messages on a thread. Actions: list, post.",
        },
        {
          name: "manage_thread_context",
          description:
            "Update summary, view summary history, add/remove tags, set/unset metadata. Actions: update_summary, list_summaries, update_tags, update_metadata.",
        },
        {
          name: "manage_webhooks",
          description:
            "Register and list webhook endpoints for event notifications. Actions: register, list.",
        },
      ],
    },
  });
}
