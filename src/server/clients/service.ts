// Adds and looks up clients. Every query is limited to the signed-in user's studio.

import "server-only";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { containsPattern } from "@/lib/list-filters";

export const clientInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase().max(254),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  externalReference: z.string().trim().max(100).optional().transform((v) => v || null),
});

export type ClientInput = z.input<typeof clientInputSchema>;

export async function createClient(organizationId: string, input: ClientInput) {
  const values = clientInputSchema.parse(input);
  const [row] = await db()
    .insert(clients)
    .values({ ...values, organizationId })
    .returning();
  return row;
}

/** Lists the studio's clients. `search` matches anywhere in the name, email, phone or external reference, ignoring case. */
export async function listClients(organizationId: string, options: { search?: string } = {}) {
  const pattern = options.search ? containsPattern(options.search) : undefined;
  return db()
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.organizationId, organizationId),
        pattern
          ? or(
              sql`(${clients.firstName} || ' ' || ${clients.lastName}) like ${pattern} escape '\\'`,
              sql`${clients.email} like ${pattern} escape '\\'`,
              sql`${clients.phone} like ${pattern} escape '\\'`,
              sql`${clients.externalReference} like ${pattern} escape '\\'`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(clients.lastName), asc(clients.firstName));
}

/** Returns undefined for another organization's client, same as for a missing one. */
export async function getClient(organizationId: string, clientId: string) {
  const [row] = await db()
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  return row;
}
