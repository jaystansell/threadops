import { describe, it, expect } from "vitest";
import { canTransition, InvalidStatusTransitionError } from "../thread-status";

describe("canTransition", () => {
  it("allows open → closed", () => {
    expect(canTransition("open", "closed")).toBe(true);
  });

  it("allows open → archived", () => {
    expect(canTransition("open", "archived")).toBe(true);
  });

  it("allows closed → open", () => {
    expect(canTransition("closed", "open")).toBe(true);
  });

  it("allows closed → archived", () => {
    expect(canTransition("closed", "archived")).toBe(true);
  });

  it("disallows archived → open", () => {
    expect(canTransition("archived", "open")).toBe(false);
  });

  it("disallows archived → closed", () => {
    expect(canTransition("archived", "closed")).toBe(false);
  });

  it("disallows archived → archived (self-transition)", () => {
    expect(canTransition("archived", "archived")).toBe(false);
  });

  it("disallows open → open (self-transition)", () => {
    expect(canTransition("open", "open")).toBe(false);
  });

  it("disallows closed → closed (self-transition)", () => {
    expect(canTransition("closed", "closed")).toBe(false);
  });
});

describe("InvalidStatusTransitionError", () => {
  it("has the correct error name", () => {
    const err = new InvalidStatusTransitionError("archived", "open");
    expect(err.name).toBe("InvalidStatusTransitionError");
  });

  it("contains from/to status in message", () => {
    const err = new InvalidStatusTransitionError("archived", "open");
    expect(err.message).toContain("archived");
    expect(err.message).toContain("open");
  });

  it("is an instance of Error", () => {
    const err = new InvalidStatusTransitionError("open", "open");
    expect(err).toBeInstanceOf(Error);
  });
});
