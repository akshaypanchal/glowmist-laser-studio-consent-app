// Builds the signed consent PDF with pdf-lib: studio header, the client's details and answers, the exact consent wording they agreed to, their drawn signature, and the signing date and document reference. No IP addresses or other audit data go in the PDF; those stay in the database.

import "server-only";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { ConsentAnswers } from "@/lib/consent-answers";
import type { TemplateContent } from "@/lib/consent-template";

export type SignedPdfInput = {
  content: TemplateContent;
  templateVersion: number;
  answers: ConsentAnswers;
  signaturePng: Uint8Array;
  signerName: string;
  signedAt: Date;
  reference: string;
  timeZone: string;
};

const PAGE = { width: 612, height: 792 }; // US Letter, points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const BRAND = rgb(0.6, 0.44, 0.17);
const MUTED = rgb(0.35, 0.33, 0.3);
const RULE = rgb(0.85, 0.83, 0.8);

/** Small layout helper that writes top to bottom and starts new pages as needed. */
class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];

  constructor(
    private doc: PDFDocument,
    public regular: PDFFont,
    public bold: PDFFont,
    private header: (w: Writer) => void,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.y = PAGE.height - MARGIN;
    this.header(this);
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + 30) this.newPage();
  }

  /** Replaces characters the built-in PDF fonts can't draw (e.g. emoji) with "?". */
  clean(text: string, font: PDFFont) {
    let out = "";
    for (const ch of text.replace(/\r?\n/g, " ")) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += "?";
      }
    }
    return out;
  }

  wrap(text: string, font: PDFFont, size: number, width: number) {
    const words = this.clean(text, font).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        // Break very long words (e.g. an email address) across lines.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  paragraph(text: string, opts: { size?: number; font?: PDFFont; x?: number; width?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.regular;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_WIDTH - (x - MARGIN);
    const lineHeight = size * 1.35;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lineHeight);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? rgb(0.1, 0.1, 0.1) });
      this.y -= lineHeight;
    }
    this.y -= opts.gap ?? 4;
  }

  heading(text: string) {
    this.ensure(40);
    this.y -= 8;
    this.page.drawText(this.clean(text.toUpperCase(), this.bold), { x: MARGIN, y: this.y - 11, size: 11, font: this.bold, color: BRAND });
    this.y -= 16;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE.width - MARGIN, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 8;
  }

  field(label: string, value: string, x = MARGIN, width = CONTENT_WIDTH) {
    const size = 10;
    const labelText = `${label}: `;
    const labelWidth = this.bold.widthOfTextAtSize(labelText, size);
    const lines = this.wrap(value || "—", this.regular, size, width - labelWidth);
    this.ensure(lines.length * 14);
    this.page.drawText(labelText, { x, y: this.y - size, size, font: this.bold });
    lines.forEach((line, i) => {
      this.page.drawText(line, { x: x + labelWidth, y: this.y - size - i * 14, size, font: this.regular });
    });
    return lines.length * 14;
  }

  /** Two fields side by side. */
  fieldRow(left: [string, string], right?: [string, string]) {
    const half = CONTENT_WIDTH / 2 - 10;
    const startY = this.y;
    const startPage = this.page;
    const h1 = this.field(left[0], left[1], MARGIN, half);
    if (this.page !== startPage) {
      // The row didn't fit and moved to a new page; draw the right field there too.
      const h2 = right ? this.field(right[0], right[1], MARGIN + half + 20, half) : 0;
      this.y -= Math.max(h1, h2) + 4;
      return;
    }
    this.y = startY;
    const h2 = right ? this.field(right[0], right[1], MARGIN + half + 20, half) : 0;
    this.y = startY - Math.max(h1, h2) - 4;
  }

  checkbox(label: string, checked: boolean, x = MARGIN, width = CONTENT_WIDTH) {
    const size = 10;
    const lines = this.wrap(label, this.regular, size, width - 18);
    this.ensure(lines.length * 13.5 + 2);
    const boxY = this.y - size;
    this.page.drawRectangle({ x, y: boxY - 1, width: 9, height: 9, borderColor: MUTED, borderWidth: 0.8 });
    if (checked) {
      this.page.drawLine({ start: { x: x + 1.5, y: boxY + 3.5 }, end: { x: x + 3.8, y: boxY + 0.8 }, thickness: 1.4, color: rgb(0, 0, 0) });
      this.page.drawLine({ start: { x: x + 3.8, y: boxY + 0.8 }, end: { x: x + 7.8, y: boxY + 7 }, thickness: 1.4, color: rgb(0, 0, 0) });
    }
    lines.forEach((line, i) => {
      this.page.drawText(line, { x: x + 15, y: boxY - i * 13.5, size, font: this.regular, color: checked ? rgb(0, 0, 0) : MUTED });
    });
    this.y -= lines.length * 13.5 + 3;
  }

  /** Checkboxes in columns, like the paper form. */
  checkboxGrid(items: { label: string; checked: boolean }[], columns: number) {
    const gap = 12;
    const colWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    for (let i = 0; i < items.length; i += columns) {
      const row = items.slice(i, i + columns);
      const heights = row.map((item) => this.wrap(item.label, this.regular, 10, colWidth - 18).length * 13.5 + 3);
      this.ensure(Math.max(...heights));
      const startY = this.y;
      row.forEach((item, c) => {
        this.y = startY;
        this.checkbox(item.label, item.checked, MARGIN + c * (colWidth + gap), colWidth);
      });
      this.y = startY - Math.max(...heights);
    }
  }
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export async function generateSignedPdf(input: SignedPdfInput): Promise<Uint8Array> {
  const { content, answers } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`${content.studio.name} - ${content.title} - ${input.reference}`);
  doc.setAuthor(content.studio.name);
  doc.setSubject(`Signed consent ${input.reference}`);
  doc.setCreationDate(input.signedAt);
  doc.setModificationDate(input.signedAt);
  doc.setProducer("GlowMist consent app");
  doc.setCreator("GlowMist consent app");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const signature = await doc.embedPng(input.signaturePng);

  const w = new Writer(doc, regular, bold, (writer) => {
    const center = (text: string, size: number, font: PDFFont, y: number, color = rgb(0.1, 0.1, 0.1)) => {
      const clean = writer.clean(text, font);
      writer.page.drawText(clean, { x: (PAGE.width - font.widthOfTextAtSize(clean, size)) / 2, y, size, font, color });
    };
    center(content.studio.name, 16, bold, writer.y - 16, BRAND);
    center(content.studio.address, 9.5, regular, writer.y - 31, MUTED);
    center(content.studio.email, 9.5, regular, writer.y - 44, MUTED);
    center(content.title.toUpperCase(), 11, bold, writer.y - 64);
    writer.y -= 76;
  });

  const c = answers.client;
  w.heading("Client information");
  w.fieldRow(["Full name", c.fullName], ["Date of birth", formatDate(c.dateOfBirth)]);
  w.fieldRow(["Email", c.email], ["Phone number", c.phone]);
  w.fieldRow(["Mailing address", c.mailingAddress]);
  w.fieldRow(["Emergency contact", c.emergencyContact], ["Emergency phone", c.emergencyPhone]);
  w.fieldRow(["Date of service", formatDate(c.dateOfService)]);

  w.heading("Treatment(s) requested");
  w.checkboxGrid(
    content.treatments.map((t) => ({ label: t, checked: answers.treatments.includes(t) })),
    3,
  );

  w.heading("Medical history");
  w.checkboxGrid(
    content.medicalConditions.map((m) => ({ label: m, checked: answers.medicalConditions.includes(m) })),
    2,
  );
  w.y -= 4;
  w.fieldRow(["Allergies", answers.allergies || "None listed"]);
  w.fieldRow(["Other medical conditions", answers.otherConditions || "None listed"]);

  w.heading("Client consent");
  for (const p of content.consentIntro) w.paragraph(p);
  w.paragraph("I understand that:", { font: bold });
  for (const item of content.understandings) w.paragraph(`•  ${item}`, { x: MARGIN + 10, gap: 2 });

  w.heading(content.photography.heading);
  for (const option of content.photography.options) w.checkbox(option.label, answers.photography.includes(option.id));

  w.heading("Acknowledgement");
  for (const p of content.acknowledgement) w.paragraph(p);

  w.heading("Signature");
  w.checkbox(content.electronicSignatureConsent, true);
  w.y -= 6;

  const sigMaxWidth = 220;
  const sigMaxHeight = 80;
  const scale = Math.min(sigMaxWidth / signature.width, sigMaxHeight / signature.height, 1);
  const sigWidth = signature.width * scale;
  const sigHeight = signature.height * scale;
  w.ensure(sigHeight + 90);
  const signedAtText = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: input.timeZone,
    timeZoneName: "short",
  }).format(input.signedAt);

  w.fieldRow(["Client name (print)", input.signerName], ["Date", signedAtText]);
  w.y -= 12;
  w.page.drawText("Client signature:", { x: MARGIN, y: w.y - 10, size: 10, font: bold });
  w.page.drawImage(signature, { x: MARGIN + 100, y: w.y - sigHeight, width: sigWidth, height: sigHeight });
  w.y -= sigHeight + 4;
  w.page.drawLine({ start: { x: MARGIN + 100, y: w.y }, end: { x: MARGIN + 100 + sigMaxWidth, y: w.y }, thickness: 0.75, color: MUTED });
  w.y -= 14;
  w.paragraph(`Electronically signed by ${input.signerName} on ${signedAtText}.`, { size: 9, color: MUTED, gap: 2 });
  w.paragraph(`Document ID: ${input.reference}  ·  Consent version ${input.templateVersion}`, { size: 9, color: MUTED, gap: 8 });

  const total = w.pages.length;
  w.pages.forEach((page, i) => {
    const footer = `${input.reference}  ·  Electronically signed  ·  Page ${i + 1} of ${total}`;
    page.drawText(footer, {
      x: (PAGE.width - regular.widthOfTextAtSize(footer, 8)) / 2,
      y: MARGIN - 20,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
