"use client";

import { useEffect, useRef } from "react";

/**
 * Renders SwaggerUI via CDN scripts inside a shadow-free container.
 * Styled to match the dark-mode theme of the app.
 */
export function SwaggerUIClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const container = containerRef.current;
    if (!container) return;

    // Load SwaggerUI CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    // Dark mode overrides
    const style = document.createElement("style");
    style.textContent = `
      .swagger-ui { background: transparent !important; }
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui, .swagger-ui .info, .swagger-ui .opblock,
      .swagger-ui .opblock-body, .swagger-ui table, .swagger-ui .model-box,
      .swagger-ui .scheme-container, .swagger-ui .btn { color: #e2e8f0 !important; }
      .swagger-ui .info .title { color: #f1f5f9 !important; }
      .swagger-ui .opblock .opblock-summary { border-color: #334155 !important; }
      .swagger-ui .opblock { background: #1e293b !important; border-color: #334155 !important; }
      .swagger-ui .opblock .opblock-section-header { background: #0f172a !important; }
      .swagger-ui .model-container { background: #1e293b !important; }
      .swagger-ui select, .swagger-ui input[type=text] {
        background: #0f172a !important; color: #e2e8f0 !important; border-color: #475569 !important;
      }
      .swagger-ui .scheme-container { background: #0f172a !important; box-shadow: none !important; }
      .swagger-ui .btn { border-color: #475569 !important; }
      .swagger-ui .btn.authorize { background: #4f46e5 !important; color: #fff !important; border-color: #4f46e5 !important; }
      .swagger-ui .opblock-tag { color: #e2e8f0 !important; border-bottom-color: #334155 !important; }
      .swagger-ui .response-col_status { color: #e2e8f0 !important; }
      .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #cbd5e1 !important; }
      .swagger-ui .highlight-code, .swagger-ui .microlight { background: #0f172a !important; color: #e2e8f0 !important; }
      .swagger-ui .markdown p, .swagger-ui .markdown li { color: #cbd5e1 !important; }
      .swagger-ui .parameter__name { color: #93c5fd !important; }
      .swagger-ui .parameter__type { color: #86efac !important; }
      body { background: #0f172a !important; }
    `;
    document.head.appendChild(style);

    // Load SwaggerUI JS
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SwaggerUIBundle = (window as any).SwaggerUIBundle;
      if (SwaggerUIBundle) {
        SwaggerUIBundle({
          url: "/api/openapi.json",
          dom_id: "#swagger-ui-container",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
        });
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">API Explorer</h1>
        <a
          href="/docs/api"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          ← Back to API docs
        </a>
      </div>
      <div id="swagger-ui-container" ref={containerRef} />
    </div>
  );
}
