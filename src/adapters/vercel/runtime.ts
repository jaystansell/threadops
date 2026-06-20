export const runtime = "edge" as const;

export function getDeploymentUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}
