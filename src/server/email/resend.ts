// Sends email through Resend. The sender address (EMAIL_FROM) must be on a domain verified in Resend.

import "server-only";
import { Resend } from "resend";
import type { EmailService, OutgoingEmail } from "./types";

export class ResendEmailService implements EmailService {
  private client: Resend;

  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail) {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        contentType: a.contentType,
      })),
    });
    if (error) throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
    return { id: data?.id ?? null };
  }
}
