"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ActionDef {
  id?: string;
  name: string;
  description: string;
  parameter_schema: Record<string, unknown>;
  builtin: boolean;
}

interface ActionPaletteProps {
  threadId: string;
}

export function ActionPalette({ threadId }: ActionPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<ActionDef[] | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionDef | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`/api/threads/${threadId}/actions`);
      if (!res.ok) {
        setActions([]);
        return;
      }
      const data = await res.json();
      setActions(data.actions ?? []);
    } catch {
      setActions([]);
    }
  }, [threadId]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !fetchedRef.current) {
        fetchedRef.current = true;
        fetchActions();
      }
      if (!next) {
        setSelectedAction(null);
        setParamValues({});
        setError(null);
      }
      return next;
    });
  }, [fetchActions]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedAction(null);
        setParamValues({});
        setError(null);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const handleSelectAction = useCallback((action: ActionDef) => {
    const schema = action.parameter_schema;
    const props = (schema?.properties ?? {}) as Record<string, unknown>;

    if (Object.keys(props).length === 0) {
      // No parameters — invoke immediately
      invokeAction(action, {});
      return;
    }

    setSelectedAction(action);
    setParamValues({});
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function invokeAction(action: ActionDef, parameters: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.name, parameters }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.validation_errors) {
          const msgs = data.validation_errors.map(
            (e: { path: string; message: string }) => `${e.path}: ${e.message}`,
          );
          setError(msgs.join("; "));
        } else {
          setError(data.error || "Action failed");
        }
        return;
      }
      setOpen(false);
      setSelectedAction(null);
      setParamValues({});
      router.refresh();
    } catch {
      setError("Failed to invoke action");
    } finally {
      setSubmitting(false);
    }
  }

  function handleParamSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAction) return;

    const schema = selectedAction.parameter_schema;
    const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
    const parameters: Record<string, unknown> = {};

    for (const [key, propSchema] of Object.entries(props)) {
      const raw = paramValues[key] ?? "";
      const propType = propSchema.type as string;

      if (propType === "number" || propType === "integer") {
        parameters[key] = raw ? Number(raw) : undefined;
      } else if (propType === "boolean") {
        parameters[key] = raw === "true";
      } else {
        parameters[key] = raw || undefined;
      }
    }

    invokeAction(selectedAction, parameters);
  }

  return (
    <div className="relative inline-block" ref={panelRef}>
      <button
        type="button"
        onClick={handleToggle}
        data-testid="action-palette-trigger"
        className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors inline-flex items-center gap-1"
        aria-label="Agent actions"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        Actions
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 z-30 w-80 max-h-72 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg"
          data-testid="action-palette-panel"
        >
          {selectedAction ? (
            <form onSubmit={handleParamSubmit} className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold truncate">
                  {selectedAction.name}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAction(null);
                    setParamValues({});
                    setError(null);
                  }}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Back
                </button>
              </div>
              {selectedAction.description && (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {selectedAction.description}
                </p>
              )}
              {renderParamFields(
                selectedAction.parameter_schema,
                paramValues,
                setParamValues,
              )}
              {error && (
                <p className="text-[11px] text-red-500">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Running..." : "Run Action"}
              </button>
            </form>
          ) : actions === null ? (
            <div className="px-3 py-4 text-xs text-[var(--muted-foreground)] text-center">
              Loading...
            </div>
          ) : actions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[var(--muted-foreground)] text-center">
              No actions available for this thread.
            </div>
          ) : (
            actions.map((action) => (
              <button
                key={action.id ?? action.name}
                type="button"
                onClick={() => handleSelectAction(action)}
                data-testid={`action-item-${action.name}`}
                className="w-full text-left px-3 py-2 hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)] last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">
                    {action.name}
                  </span>
                  {action.builtin && (
                    <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                      built-in
                    </span>
                  )}
                </div>
                {action.description && (
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                    {action.description}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function renderParamFields(
  schema: Record<string, unknown>,
  values: Record<string, string>,
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  const properties = (schema?.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((schema?.required ?? []) as string[]);

  return Object.entries(properties).map(([key, propSchema]) => {
    const label = key.replace(/_/g, " ");
    const propType = propSchema.type as string;
    const enumVals = propSchema.enum as string[] | undefined;
    const isRequired = required.has(key);
    const description = propSchema.description as string | undefined;

    return (
      <div key={key} className="space-y-0.5">
        <label className="block text-[11px] font-medium text-[var(--foreground)]">
          {label}
          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {description && (
          <p className="text-[10px] text-[var(--muted-foreground)]">
            {description}
          </p>
        )}
        {enumVals ? (
          <select
            value={values[key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [key]: e.target.value }))
            }
            required={isRequired}
            className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
          >
            <option value="">Select...</option>
            {enumVals.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : propType === "boolean" ? (
          <select
            value={values[key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [key]: e.target.value }))
            }
            className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
          >
            <option value="">Select...</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type={propType === "number" || propType === "integer" ? "number" : "text"}
            value={values[key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [key]: e.target.value }))
            }
            required={isRequired}
            placeholder={propSchema.description as string | undefined}
            className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
          />
        )}
      </div>
    );
  });
}
