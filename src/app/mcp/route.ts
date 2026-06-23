export const dynamic = "force-dynamic";

async function handler(req: Request): Promise<Response> {
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

export async function OPTIONS(req: Request) {
  return handler(req);
}
