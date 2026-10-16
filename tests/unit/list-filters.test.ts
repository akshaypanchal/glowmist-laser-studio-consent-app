// Tests the search and date range filters on the Clients and Documents lists, and the helpers that read them from the URL.

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cleanDay, cleanSearch, containsPattern, startOfStudioDay, studioDayRange } from "@/lib/list-filters";
import { createClient, listClients } from "@/server/clients/service";
import { db } from "@/server/db";
import { consentDocuments } from "@/server/db/schema";
import { listDocuments } from "@/server/documents/queries";
import { createConsentDocument } from "@/server/documents/service";
import { completeSigning } from "@/server/signing/complete";
import { createStudio, testContext, tokenFromUrl } from "./helpers/fixtures";
import { useFreshDatabase } from "./helpers/db";
import { validSubmission } from "./helpers/png";

beforeAll(useFreshDatabase);

describe("URL helpers", () => {
  it("trims search text and drops empty searches", () => {
    expect(cleanSearch("  jane ")).toBe("jane");
    expect(cleanSearch("   ")).toBeUndefined();
    expect(cleanSearch(undefined)).toBeUndefined();
    expect(cleanSearch(["a", "b"])).toBe("a");
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(cleanDay("2026-10-16")).toBe("2026-10-16");
    expect(cleanDay("2026-02-30")).toBeUndefined();
    expect(cleanDay("16/10/2026")).toBeUndefined();
    expect(cleanDay("")).toBeUndefined();
  });

  it("finds midnight in the studio's time zone, including across daylight-saving changes", () => {
    expect(startOfStudioDay("2026-10-16", "America/Toronto").toISOString()).toBe("2026-10-16T04:00:00.000Z");
    expect(startOfStudioDay("2026-01-15", "America/Toronto").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    // Clocks go back on 2026-11-01 in Toronto; midnight that day is still daylight time.
    expect(startOfStudioDay("2026-11-01", "America/Toronto").toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(startOfStudioDay("2026-11-02", "America/Toronto").toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(startOfStudioDay("2026-10-16", "UTC").toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("includes the whole To day in a range", () => {
    const range = studioDayRange("2026-10-01", "2026-10-31", "America/Toronto");
    expect(range.from?.toISOString()).toBe("2026-10-01T04:00:00.000Z");
    expect(range.before?.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(studioDayRange(undefined, undefined, "UTC")).toEqual({ from: undefined, before: undefined });
  });
});

describe("client search", () => {
  it("matches name, full name, email and phone, ignoring case, within one studio", async () => {
    const a = await createStudio("A");
    const b = await createStudio("B");
    await createClient(a.org.id, { firstName: "Priya", lastName: "Shah", email: "priya@example.com", phone: "416-555-0199" });

    const names = async (search?: string) => (await listClients(a.org.id, { search })).map((c) => c.firstName);
    expect(await names()).toEqual(["Jane", "Priya"]);
    expect(await names("pRiYa")).toEqual(["Priya"]);
    expect(await names("jane doe")).toEqual(["Jane"]);
    expect(await names("@example.com")).toEqual(["Jane", "Priya"]);
    expect(await names("555-0199")).toEqual(["Priya"]);
    expect(await names("%")).toEqual([]);
    expect(await listClients(b.org.id, { search: "priya" })).toHaveLength(0);
  });
});

describe("document search and date range", () => {
  it("filters by client, form, reference and the shown date", async () => {
    const s = await createStudio();
    const other = await createClient(s.org.id, { firstName: "Priya", lastName: "Shah", email: "priya@example.com" });
    const janes = await createConsentDocument(s.actor, { clientId: s.client.id, templateId: s.template.id });
    const priyas = await createConsentDocument(s.actor, { clientId: other.id, templateId: s.template.id });
    await completeSigning(tokenFromUrl(priyas.signingUrl), validSubmission(), testContext);

    // Jane's form was sent on Oct 1; Priya's was sent Sep 20 and signed Oct 10 (Toronto time).
    await db()
      .update(consentDocuments)
      .set({ createdAt: new Date("2026-10-01T15:00:00Z") })
      .where(eq(consentDocuments.id, janes.document.id));
    await db()
      .update(consentDocuments)
      .set({ createdAt: new Date("2026-09-20T15:00:00Z"), completedAt: new Date("2026-10-11T02:00:00Z") })
      .where(eq(consentDocuments.id, priyas.document.id));

    const ids = async (options: Parameters<typeof listDocuments>[1]) =>
      (await listDocuments(s.org.id, options)).map((d) => d.id).sort();
    const range = (from?: string, to?: string) => studioDayRange(from, to, "America/Toronto");

    expect(await ids({ search: "shah" })).toEqual([priyas.document.id]);
    expect(await ids({ search: "jane@" })).toEqual([janes.document.id]);
    expect(await ids({ search: "treatment" })).toHaveLength(2);
    expect(await ids({ search: janes.document.reference.toLowerCase() })).toEqual([janes.document.id]);

    // Priya signed at 10 pm on Oct 10 in Toronto (02:00 UTC on Oct 11), so she belongs to Oct 10.
    expect(await ids(range("2026-10-10", "2026-10-10"))).toEqual([priyas.document.id]);
    expect(await ids(range("2026-10-11"))).toEqual([]);
    expect(await ids(range(undefined, "2026-10-01"))).toEqual([janes.document.id]);
    expect(await ids(range("2026-09-01", "2026-09-30"))).toEqual([]);
    expect(await ids({ ...range("2026-10-01", "2026-10-31"), search: "jane", status: "SENT" })).toEqual([janes.document.id]);
  });
});
