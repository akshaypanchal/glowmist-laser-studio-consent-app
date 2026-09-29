// Test helper: builds a small valid PNG (a black line on transparent) and valid form answers.

import { deflateSync } from "node:zlib";
import { GLOWMIST_CONSENT_V1 } from "@/lib/consent-template";

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function signaturePngDataUrl(width = 120, height = 40) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) {
      if (Math.abs(y - height / 2 - Math.round(8 * Math.sin(x / 10))) < 2) row.writeUInt32BE(0x000000ff, 1 + x * 4);
    }
    rows.push(row);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function validAnswers() {
  return {
    client: {
      fullName: "Jane Doe",
      dateOfBirth: "1990-04-12",
      email: "jane@example.com",
      phone: "905-555-0100",
      mailingAddress: "1 Main St, Bradford ON",
      emergencyContact: "John Doe",
      emergencyPhone: "905-555-0199",
      dateOfService: "2026-09-26",
    },
    treatments: [GLOWMIST_CONSENT_V1.treatments[0]],
    medicalConditions: [GLOWMIST_CONSENT_V1.medicalConditions[4]],
    allergies: "Latex",
    otherConditions: "",
    photography: ["record"],
  };
}

export function validSubmission() {
  return { consentAccepted: true, signature: signaturePngDataUrl(), signerName: "Jane Doe", answers: validAnswers() };
}
