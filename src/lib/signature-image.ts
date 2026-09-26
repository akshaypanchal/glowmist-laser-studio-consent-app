// Checks the drawn signature sent from the browser: it must be a PNG data URL of reasonable size. Returns the raw PNG bytes.

const PREFIX = "data:image/png;base64,";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const MAX_SIGNATURE_BYTES = 512 * 1024;

export function decodeSignatureDataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith(PREFIX)) return null;
  const base64 = dataUrl.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  if (bytes.length < PNG_MAGIC.length || bytes.length > MAX_SIGNATURE_BYTES) return null;
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return null;
  return bytes;
}
