// Picks the email driver from EMAIL_DRIVER ("resend" or "console"). The rest of the app only calls emailService().

import "server-only";
import { env } from "@/server/env";
import { ConsoleEmailService } from "./console";
import { ResendEmailService } from "./resend";
import type { EmailService } from "./types";

let instance: EmailService | undefined;

export function emailService(): EmailService {
  if (!instance) {
    const config = env();
    instance =
      config.EMAIL_DRIVER === "resend" ? new ResendEmailService(config.RESEND_API_KEY!, config.EMAIL_FROM) : new ConsoleEmailService();
  }
  return instance;
}

/** Test helper. */
export function setEmailService(service: EmailService | undefined) {
  instance = service;
}

export type { EmailService, OutgoingEmail } from "./types";
