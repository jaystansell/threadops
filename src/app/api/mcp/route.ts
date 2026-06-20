export const dynamic = "force-dynamic";

async function handler(req: Request): Promise<Response> {
  // Dynamic import to avoid MCP SDK module resolution issues at build time.
  // The SDK uses .js extension imports that Turbopack can't resolve during
  // static analysis, but work fine at runtime with the bundler.
  const { handleMcpRequest } = await import("@/mcp/http-handler");
  return handleMcpRequest(req);
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

export async function DELETE(req: Request) {
  return handler(req);
}
