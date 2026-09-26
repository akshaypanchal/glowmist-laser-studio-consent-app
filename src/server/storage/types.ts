export interface StorageService {
  upload(key: string, data: Uint8Array, contentType: string): Promise<void>;
  download(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /**
   * A short-lived URL the browser can fetch the file from, or null when the
   * driver has no such URL and the app must stream the bytes itself.
   */
  createSignedUrl(key: string, expiresInSeconds: number, downloadName?: string): Promise<string | null>;
}

export const storageKeys = {
  signedPdf: (organizationId: string, documentId: string) => `documents/${organizationId}/${documentId}/signed.pdf`,
  signature: (organizationId: string, documentId: string, signatureId: string) =>
    `signatures/${organizationId}/${documentId}/${signatureId}.png`,
};
