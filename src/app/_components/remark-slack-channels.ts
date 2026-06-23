import { visit } from "unist-util-visit";
import type { Root, Text, PhrasingContent } from "mdast";

/**
 * Remark plugin that detects Slack-style #channel-name references in text
 * and converts them to link nodes with a `slack-channel:` URL scheme.
 *
 * The component layer (thread-timeline.tsx) renders these as styled badges.
 */

const SLACK_CHANNEL_RE = /(?<![a-zA-Z0-9\/.:_])#([a-z][a-z0-9-]{0,79})\b/g;

export function remarkSlackChannels() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (index === undefined || !parent) return;
      if (parent.type === "link") return;

      const text = node.value;
      SLACK_CHANNEL_RE.lastIndex = 0;

      const parts: PhrasingContent[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = SLACK_CHANNEL_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
        }

        parts.push({
          type: "link",
          url: `slack-channel:${match[1]}`,
          children: [{ type: "text", value: `#${match[1]}` }],
        });

        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) return;

      if (lastIndex < text.length) {
        parts.push({ type: "text", value: text.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...parts);
    });
  };
}
