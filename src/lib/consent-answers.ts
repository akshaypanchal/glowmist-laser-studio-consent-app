// Validates what the client fills in on the signing page (details, treatments, medical history, photo choices) against the template they were shown. Used by both the browser form and the server.

import { z } from "zod";
import type { TemplateContent } from "./consent-template";

const text = (max: number) => z.string().trim().max(max);
const requiredText = (label: string, max = 200) => text(max).min(1, `${label} is required`);
const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} is not a valid date`);

export const clientDetailsSchema = z.object({
  fullName: requiredText("Full name", 200),
  dateOfBirth: isoDate("Date of birth"),
  email: z.email("Enter a valid email").trim().max(254),
  phone: requiredText("Phone number", 40),
  mailingAddress: requiredText("Mailing address", 500),
  emergencyContact: requiredText("Emergency contact", 200),
  emergencyPhone: requiredText("Emergency phone", 40),
  dateOfService: isoDate("Date of service"),
});

/**
 * Builds the answer schema for one template version, so only treatments,
 * conditions and photo options that exist in that version are accepted.
 */
export function answersSchema(content: TemplateContent) {
  const exclusive = new Set(content.photography.options.filter((o) => o.exclusive).map((o) => o.id));
  return z
    .object({
      client: clientDetailsSchema,
      treatments: z
        .array(z.enum(content.treatments as [string, ...string[]]))
        .min(1, "Choose at least one treatment")
        .transform((v) => [...new Set(v)]),
      medicalConditions: z
        .array(z.enum(content.medicalConditions as [string, ...string[]]))
        .transform((v) => [...new Set(v)]),
      allergies: text(1000).default(""),
      otherConditions: text(1000).default(""),
      photography: z
        .array(z.enum(content.photography.options.map((o) => o.id) as [string, ...string[]]))
        .min(1, "Choose a photography option")
        .transform((v) => [...new Set(v)]),
    })
    .superRefine((value, ctx) => {
      if (value.photography.some((id) => exclusive.has(id)) && value.photography.length > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["photography"],
          message: "\"I do not consent to photography\" can't be combined with other photography options",
        });
      }
    });
}

export type ConsentAnswers = z.infer<ReturnType<typeof answersSchema>>;
