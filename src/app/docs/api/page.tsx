import type { Metadata } from "next";
import { ApiDocsClient } from "./api-docs-client";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "ThreadOps REST API reference — v1",
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
