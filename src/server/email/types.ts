// The common interface for sending email, so the app doesn't depend on Resend directly and tests can use a fake.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Uint8Array; contentType: string }[];
};

export interface EmailService {
  /** Returns the provider's message id. Throws if the provider rejects the email. */
  send(email: OutgoingEmail): Promise<{ id: string | null }>;
}
