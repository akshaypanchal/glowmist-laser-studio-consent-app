import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { computeEventHash, verifyChain } from "@/server/audit/hash";
import { listDocumentEvents, recordEvent, verifyDocumentChain } from "@/server/audit/service";
import { db } from "@/server/db";
import { auditEvents, organizations } from "@/server/db/schema";
import { useFreshDatabase } from "./helpers/db";

let orgId: string;

beforeAll(async () => {
  await useFreshDatabase();
  const [org] = await db().insert(organizations).values({ name: "Test Studio" }).returning();
  orgId = org.id;
});

describe("audit hash chain", () => {
  it("links each event to the previous one", async () => {
    await recordEvent({ organizationId: orgId, eventType: "DOCUMENT_CREATED", actorType: "USER", actorId: "u1" });
    await recordEvent({ organizationId: orgId, eventType: "DOCUMENT_SENT", actorType: "USER", metadata: { a: 1 } });
    await recordEvent({
      organizationId: orgId,
      eventType: "DOCUMENT_VIEWED",
      actorType: "SIGNER",
      context: { ipAddress: "203.0.113.5", userAgent: "test" },
    });

    const rows = await db().select().from(auditEvents).where(eq(auditEvents.organizationId, orgId));
    expect(rows.map((r) => r.sequence).sort()).toEqual([1, 2, 3]);
    const byseq = rows.sort((a, b) => a.sequence - b.sequence);
    expect(byseq[0].previousEventHash).toBeNull();
    expect(byseq[1].previousEventHash).toBe(byseq[0].eventHash);
    expect(byseq[2].previousEventHash).toBe(byseq[1].eventHash);
  });

  it("detects a modified event", async () => {
    const rows = (await db().select().from(auditEvents).where(eq(auditEvents.organizationId, orgId))).sort(
      (a, b) => a.sequence - b.sequence,
    );
    const chain = rows.map((r) => ({ ...r, metadata: JSON.parse(r.metadata) as Record<string, unknown> }));
    expect(verifyChain(chain)).toEqual({ valid: true });

    const tampered = chain.map((e) => (e.sequence === 2 ? { ...e, metadata: { a: 2 } } : e));
    expect(verifyChain(tampered)).toMatchObject({ valid: false, brokenAtSequence: 2 });

    const removed = chain.filter((e) => e.sequence !== 2);
    expect(verifyChain(removed)).toMatchObject({ valid: false });
  });

  it("keeps separate chains per document and does not fork under concurrency", async () => {
    // documentId has a foreign key, so use organization-level chain with concurrent writes.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        recordEvent({ organizationId: orgId, eventType: "EMAIL_SENT", actorType: "SYSTEM" }),
      ),
    );
    const rows = (await db().select().from(auditEvents).where(eq(auditEvents.organizationId, orgId))).sort(
      (a, b) => a.sequence - b.sequence,
    );
    expect(rows).toHaveLength(13);
    expect(verifyChain(rows.map((r) => ({ ...r, metadata: JSON.parse(r.metadata) })))).toEqual({ valid: true });
  });

  it("hash depends on every field", () => {
    const base = {
      organizationId: "o",
      documentId: null,
      sequence: 1,
      eventType: "X",
      actorType: "USER",
      actorId: null,
      timestamp: new Date(0),
      ipAddress: null,
      userAgent: null,
      metadata: {},
      previousEventHash: null,
    };
    expect(computeEventHash(base)).not.toBe(computeEventHash({ ...base, ipAddress: "1.1.1.1" }));
    expect(computeEventHash(base)).not.toBe(computeEventHash({ ...base, timestamp: new Date(1) }));
  });

  it("lists and verifies a document chain", async () => {
    expect(await listDocumentEvents(orgId, "missing")).toEqual([]);
    expect(await verifyDocumentChain(orgId, "missing")).toEqual({ valid: true });
  });
});
