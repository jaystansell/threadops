import type { Metadata } from "next";
import { SwaggerUIClient } from "./swagger-ui-client";

export const metadata: Metadata = {
  title: "API Explorer — Threadzy",
  description: "Interactive OpenAPI explorer for the Threadzy REST API.",
};

export default function ApiExplorePage() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg)]">
      <SwaggerUIClient />
    </div>
  );
}
