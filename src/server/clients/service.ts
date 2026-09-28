// Adds and looks up clients. Every query is limited to the signed-in user's studio.

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { clients } from "@/server/db/schema";

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

export async function listClients(organizationId: string) {
  return db()
    .select()
    .from(clients)
    .where(eq(clients.organizationId, organizationId))
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
