// Development email driver: logs that an email would be sent (recipient and subject only, never the contents) instead of sending it.

import "server-only";
import type { EmailService, OutgoingEmail } from "./types";

export class ConsoleEmailService implements EmailService {
  async send(email: OutgoingEmail) {
    console.info(`[email:console] to=${email.to} subject="${email.subject}" attachments=${email.attachments?.length ?? 0}`);
    return { id: `console-${crypto.randomUUID()}` };
  }
}
