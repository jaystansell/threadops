"use client";

import { useState, useCallback } from "react";

interface SavedPrompt {
  id: string;
  user_id: string;
  title: string;
  body: string;
  agent_scope: { all: true } | { api_key_ids: string[] };
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  label: string;
}

interface SavedPromptsClientProps {
  initialPrompts: SavedPrompt[];
  agents: Agent[];
}

type FormMode = "idle" | "create" | "edit";

export function SavedPromptsClient({
  initialPrompts,
  agents,
}: SavedPromptsClientProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>(initialPrompts);
  const [mode, setMode] = useState<FormMode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setMode("idle");
    setEditingId(null);
    setTitle("");
    setBody("");
    setScopeAll(true);
    setSelectedAgentIds(new Set());
    setError(null);
  }, []);

  const startCreate = useCallback(() => {
    resetForm();
    setMode("create");
  }, [resetForm]);

  const startEdit = useCallback(
    (prompt: SavedPrompt) => {
      resetForm();
      setMode("edit");
      setEditingId(prompt.id);
      setTitle(prompt.title);
      setBody(prompt.body);
      if ("all" in prompt.agent_scope && prompt.agent_scope.all) {
        setScopeAll(true);
        setSelectedAgentIds(new Set());
      } else if ("api_key_ids" in prompt.agent_scope) {
        setScopeAll(false);
        setSelectedAgentIds(new Set(prompt.agent_scope.api_key_ids));
      }
    },
    [resetForm],
  );

  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    if (!scopeAll && selectedAgentIds.size === 0) {
      setError("Select at least one agent or choose 'All agents'.");
      return;
    }

    const agentScope = scopeAll
      ? { all: true }
      : { api_key_ids: Array.from(selectedAgentIds) };

    setSaving(true);
    setError(null);

    try {
      if (mode === "create") {
        const res = await fetch("/api/saved-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            agent_scope: agentScope,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to create prompt");
        }
        const created: SavedPrompt = await res.json();
        setPrompts((prev) => [created, ...prev]);
      } else if (mode === "edit" && editingId) {
        const res = await fetch(`/api/saved-prompts/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            agent_scope: agentScope,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to update prompt");
        }
        const updated: SavedPrompt = await res.json();
        setPrompts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [title, body, scopeAll, selectedAgentIds, mode, editingId, resetForm]);

  const handleDelete = useCallback(async (promptId: string) => {
    if (!window.confirm("Delete this prompt? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/saved-prompts/${promptId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete prompt");
      }
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
    } catch {
      alert("Failed to delete prompt. Please try again.");
    }
  }, []);

  const scopeLabel = (prompt: SavedPrompt): string => {
    if ("all" in prompt.agent_scope && prompt.agent_scope.all) {
      return "All agents";
    }
    if ("api_key_ids" in prompt.agent_scope) {
      const ids = prompt.agent_scope.api_key_ids;
      const names = ids
        .map((id) => agents.find((a) => a.id === id)?.label ?? id.slice(0, 8))
        .join(", ");
      return names || "No agents";
    }
    return "All agents";
  };

  return (
    <div className="space-y-4">
      {/* Create / Cancel button */}
      {mode === "idle" ? (
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
        >
          + New Prompt
        </button>
      ) : (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <h3 className="text-sm font-semibold">
            {mode === "create" ? "Create Prompt" : "Edit Prompt"}
          </h3>

          {error && (
            <p className="text-xs text-[var(--destructive)]">{error}</p>
          )}

          <div>
            <label
              htmlFor="prompt-title"
              className="block text-xs text-[var(--muted-foreground)] mb-1"
            >
              Title
            </label>
            <input
              id="prompt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bug Report Template"
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="prompt-body"
              className="block text-xs text-[var(--muted-foreground)] mb-1"
            >
              Prompt Body
            </label>
            <textarea
              id="prompt-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Enter the prompt text..."
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
            />
          </div>

          <div>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              Scope
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeAll}
                  onChange={() => {
                    setScopeAll(true);
                    setSelectedAgentIds(new Set());
                  }}
                  className="accent-[var(--accent)]"
                />
                All agents
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={!scopeAll}
                  onChange={() => setScopeAll(false)}
                  className="accent-[var(--accent)]"
                />
                Specific agents
              </label>

              {!scopeAll && (
                <div className="ml-6 space-y-1">
                  {agents.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No active agents. Create an API key first.
                    </p>
                  ) : (
                    agents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.has(agent.id)}
                          onChange={() => toggleAgent(agent.id)}
                          className="accent-[var(--accent)]"
                        />
                        {agent.label}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : mode === "create" ? "Create" : "Update"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Prompts list */}
      {prompts.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No saved prompts yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="group rounded-lg border border-[var(--border)] p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">
                    {prompt.title}
                  </h3>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {scopeLabel(prompt)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(prompt)}
                    className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                    aria-label="Edit prompt"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prompt.id)}
                    className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    aria-label="Delete prompt"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap line-clamp-3">
                {prompt.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
