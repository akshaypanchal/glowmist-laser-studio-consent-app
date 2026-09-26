// The wording of each email the app sends: the signing invitation, the client's signed copy and the studio's records copy. Each has an HTML and a plain-text version.

import "server-only";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(studioName: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#faf8f5;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<h1 style="font-family:Georgia,serif;font-weight:normal;color:#7a5622;font-size:24px;margin:0 0 24px">${escape(studioName)}</h1>
${bodyHtml}
</div></body></html>`;
}

const p = (text: string) => `<p style="font-size:15px;line-height:1.5;margin:0 0 16px">${text}</p>`;

function rows(items: [string, string][]) {
  return `<table style="font-size:14px;border-collapse:collapse;margin:0 0 16px">${items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#57534e;vertical-align:top">${escape(k)}</td><td style="padding:4px 0;font-family:${
          k.includes("hash") ? "monospace" : "inherit"
        };word-break:break-all">${escape(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

export function signingInvitationEmail(input: { studioName: string; firstName: string; url: string; expiresAt: string }) {
  const subject = `Please complete your consent form for ${input.studioName}`;
  const html = layout(
    input.studioName,
    p(`Hello ${escape(input.firstName)},`) +
      p("Before your treatment, please review and sign your consent form using the private link below.") +
      `<p style="margin:24px 0"><a href="${escape(input.url)}" style="background:#9c6f2c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px">Review and sign</a></p>` +
      p(`This link is personal to you and expires on ${escape(input.expiresAt)}. Please don't forward it.`) +
      p(`If the button doesn't work, copy this address into your browser:<br><span style="word-break:break-all;color:#57534e">${escape(input.url)}</span>`),
  );
  const text = `Hello ${input.firstName},

Before your treatment, please review and sign your consent form using this private link:

${input.url}

This link is personal to you and expires on ${input.expiresAt}. Please don't forward it.

${input.studioName}`;
  return { subject, html, text };
}

export function signedCopyClientEmail(input: { studioName: string; firstName: string; reference: string; signedOn: string }) {
  const subject = "Your Signed Consent Form";
  const html = layout(
    input.studioName,
    p(`Hello ${escape(input.firstName)},`) +
      p("Thank you for completing the consent form. Attached is a copy of the signed document for your records.") +
      rows([
        ["Document ID", input.reference],
        ["Signed", input.signedOn],
      ]),
  );
  const text = `Hello ${input.firstName},

Thank you for completing the consent form. Attached is a copy of the signed document for your records.

Document ID: ${input.reference}
Signed: ${input.signedOn}

${input.studioName}`;
  return { subject, html, text };
}

export function signedCopyOrganizationEmail(input: {
  studioName: string;
  clientName: string;
  templateLabel: string;
  reference: string;
  signedAt: string;
  documentHash: string;
}) {
  const subject = `Signed Consent: ${input.clientName}, ${input.reference}`;
  const details: [string, string][] = [
    ["Client", input.clientName],
    ["Document", input.templateLabel],
    ["Signed", input.signedAt],
    ["Document hash", input.documentHash],
    ["Document ID", input.reference],
  ];
  const html = layout(input.studioName, p("A consent form has been completed.") + rows(details) + p("The signed PDF is attached."));
  const text = `A consent form has been completed.

${details.map(([k, v]) => `${k}: ${v}`).join("\n")}

Attached: signed-consent.pdf`;
  return { subject, html, text };
}
