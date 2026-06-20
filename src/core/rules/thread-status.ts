import type { ThreadStatus } from "../types";

const ALLOWED_TRANSITIONS: Record<ThreadStatus, ThreadStatus[]> = {
  open: ["archived"],
  archived: ["open"],
};

export function canTransition(
  from: ThreadStatus,
  to: ThreadStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: ThreadStatus, to: ThreadStatus) {
    super(`Cannot transition thread from "${from}" to "${to}"`);
    this.name = "InvalidStatusTransitionError";
  }
}
