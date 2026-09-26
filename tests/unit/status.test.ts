// Tests which document status changes are allowed.

import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, InvalidTransitionError } from "@/server/documents/status";

describe("document status transitions", () => {
  it("allows the signing path", () => {
    expect(canTransition("DRAFT", "SENT")).toBe(true);
    expect(canTransition("SENT", "VIEWED")).toBe(true);
    expect(canTransition("VIEWED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "SIGNED")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DECLINED")).toBe(true);
    expect(canTransition("SIGNED", "VOIDED")).toBe(true);
  });

  it("rejects arbitrary changes", () => {
    expect(canTransition("DRAFT", "SIGNED")).toBe(false);
    expect(canTransition("SIGNED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("VOIDED", "SIGNED")).toBe(false);
    expect(() => assertTransition("SENT", "SIGNED")).toThrow(InvalidTransitionError);
  });
});
