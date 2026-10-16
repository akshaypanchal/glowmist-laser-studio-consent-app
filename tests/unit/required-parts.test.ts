// Checks that the required-field markers on the signing page come straight from the answer validation rules.

import { describe, expect, it } from "vitest";
import { requiredParts } from "@/lib/consent-answers";
import { GLOWMIST_CONSENT_V1 } from "@/lib/consent-template";

describe("requiredParts", () => {
  it("marks every client detail, a treatment and a photo choice as required, and medical history as optional", () => {
    const parts = requiredParts(GLOWMIST_CONSENT_V1);
    expect(Object.values(parts.client).every(Boolean)).toBe(true);
    expect(Object.keys(parts.client)).toHaveLength(7);
    expect(parts).toMatchObject({
      treatments: true,
      photography: true,
      medicalConditions: false,
      allergies: false,
      otherConditions: false,
    });
  });
});
