const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://threadops-jade.vercel.app";

export async function GET() {
  return Response.json({
    mcp: {
      version: "1.0",
      endpoint: `${BASE_URL}/api/mcp`,
      transport: "streamable-http",
      auth: {
        type: "bearer",
        header: "Authorization",
        description: "Use your Threadzy API key as the Bearer token.",
      },
      tools: [
        "list_threads",
        "create_thread",
        "get_messages",
        "post_message",
        "update_thread_status",
        "register_webhook",
        "list_webhooks",
      ],
    },
  });
}
