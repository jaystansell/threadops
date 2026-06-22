"use client";

import { useState, useCallback } from "react";
import type { AgentGroup, AgentKeyInfo } from "@/app/threads/layout";

const GROUP_COLORS = [
  { label: "Teal", value: "teal", bg: "#14B8A6" },
  { label: "Blue", value: "blue", bg: "#2563EB" },
  { label: "Indigo", value: "indigo", bg: "#4F46E5" },
  { label: "Purple", value: "purple", bg: "#7C3AED" },
  { label: "Emerald", value: "emerald", bg: "#059669" },
  { label: "Amber", value: "amber", bg: "#D97706" },
  { label: "Rose", value: "rose", bg: "#E11D48" },
  { label: "Cyan", value: "cyan", bg: "#0891B2" },
  { label: "Slate", value: "slate", bg: "#475569" },
  { label: "Forest", value: "forest", bg: "#1E6B5A" },
];

export const GROUP_COLOR_MAP: Record<string, { bg: string; fg: string }> = {};
for (const c of GROUP_COLORS) {
  GROUP_COLOR_MAP[c.value] = { bg: c.bg, fg: "#ffffff" };
}

interface Props {
  groups: AgentGroup[];
  agentKeys: AgentKeyInfo[];
  onClose: () => void;
  onSave: (groups: AgentGroup[]) => void;
}

type EditableGroup = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  agent_key_ids: string[];
  isNew?: boolean;
};

export function ManageGroupsModal({ groups, agentKeys, onClose, onSave }: Props) {
  const [editGroups, setEditGroups] = useState<EditableGroup[]>(
    groups.map((g) => ({ ...g })),
  );
  const [saving, setSaving] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const addGroup = useCallback(() => {
    const tempId = `new-${Date.now()}`;
    setEditGroups((prev) => [
      ...prev,
      {
        id: tempId,
        name: "",
        color: "teal",
        sort_order: prev.length,
        agent_key_ids: [],
        isNew: true,
      },
    ]);
    setEditingGroupId(tempId);
  }, []);

  const removeGroup = useCallback((id: string) => {
    setEditGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const updateGroup = useCallback(
    (id: string, updates: Partial<EditableGroup>) => {
      setEditGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      );
    },
    [],
  );

  const toggleAgent = useCallback(
    (groupId: string, keyId: string) => {
      setEditGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const has = g.agent_key_ids.includes(keyId);
          return {
            ...g,
            agent_key_ids: has
              ? g.agent_key_ids.filter((k) => k !== keyId)
              : [...g.agent_key_ids, keyId],
          };
        }),
      );
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved: AgentGroup[] = [];

      for (const g of editGroups) {
        if (!g.name.trim()) continue;

        if (g.isNew) {
          const res = await fetch("/api/agent-groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: g.name.trim(),
              color: g.color,
              agent_key_ids: g.agent_key_ids,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            saved.push(data);
          }
        } else {
          const original = groups.find((og) => og.id === g.id);
          const changed =
            original?.name !== g.name.trim() ||
            original?.color !== g.color ||
            JSON.stringify([...(original?.agent_key_ids ?? [])].sort()) !==
              JSON.stringify([...g.agent_key_ids].sort());

          if (changed) {
            await fetch(`/api/agent-groups/${g.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: g.name.trim(),
                color: g.color,
                agent_key_ids: g.agent_key_ids,
              }),
            });
          }
          saved.push({
            id: g.id,
            name: g.name.trim(),
            color: g.color,
            sort_order: g.sort_order,
            agent_key_ids: g.agent_key_ids,
          });
        }
      }

      // Delete removed groups
      const savedIds = new Set(editGroups.filter((g) => !g.isNew && g.name.trim()).map((g) => g.id));
      for (const og of groups) {
        if (!savedIds.has(og.id)) {
          await fetch(`/api/agent-groups/${og.id}`, { method: "DELETE" });
        }
      }

      onSave(saved);
    } finally {
      setSaving(false);
    }
  };

  // Which agents are already assigned to any group
  const assignedKeyIds = new Set(editGroups.flatMap((g) => g.agent_key_ids));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Manage Agent Groups</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {editGroups.length === 0 && (
            <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
              No groups yet. Create one to organize your agents.
            </p>
          )}

          {editGroups.map((group) => {
            const isEditing = editingGroupId === group.id;
            return (
              <div
                key={group.id}
                className="border border-[var(--border)] rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                  style={{
                    backgroundColor: GROUP_COLOR_MAP[group.color]?.bg ?? "#14B8A6",
                    color: "#ffffff",
                  }}
                  onClick={() => setEditingGroupId(isEditing ? null : group.id)}
                >
                  <svg
                    className={`w-3 h-3 shrink-0 transition-transform ${isEditing ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {group.isNew || isEditing ? (
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Group name..."
                      className="flex-1 bg-transparent text-xs font-semibold placeholder:text-white/50 outline-none border-b border-white/30 py-0.5"
                      autoFocus={group.isNew}
                    />
                  ) : (
                    <span className="text-xs font-semibold truncate flex-1">
                      {group.name}
                    </span>
                  )}
                  <span className="text-[10px] opacity-75">
                    {group.agent_key_ids.length} agent{group.agent_key_ids.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(group.id);
                    }}
                    className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                    title="Delete group"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {isEditing && (
                  <div className="p-3 space-y-3 bg-[var(--muted)]/30">
                    {/* Color picker */}
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                        Color
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {GROUP_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => updateGroup(group.id, { color: c.value })}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                              group.color === c.value
                                ? "border-white ring-2 ring-[var(--primary)]"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: c.bg }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Agent checkboxes */}
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                        Agents in this group
                      </p>
                      <div className="space-y-1">
                        {agentKeys.map((key) => {
                          const isInGroup = group.agent_key_ids.includes(key.id);
                          const isInOtherGroup =
                            !isInGroup && assignedKeyIds.has(key.id);
                          return (
                            <label
                              key={key.id}
                              className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--muted)] cursor-pointer transition-colors ${
                                isInOtherGroup ? "opacity-40" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isInGroup}
                                onChange={() => toggleAgent(group.id, key.id)}
                                disabled={isInOtherGroup}
                                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span className="text-xs">
                                {key.label}
                              </span>
                              {isInOtherGroup && (
                                <span className="text-[10px] text-[var(--muted-foreground)]">
                                  (in another group)
                                </span>
                              )}
                            </label>
                          );
                        })}
                        {agentKeys.length === 0 && (
                          <p className="text-xs text-[var(--muted-foreground)] py-1">
                            No agents found. Create an API key first.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addGroup}
            className="w-full px-3 py-2 text-xs font-medium rounded border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)] transition-colors"
          >
            + New Group
          </button>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-3 py-1.5 text-sm font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Groups"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
