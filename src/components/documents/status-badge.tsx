// Coloured badge for a document's status.

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/server/db/schema";

const TONES: Record<DocumentStatus, "neutral" | "positive" | "attention" | "negative" | "info"> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "info",
  IN_PROGRESS: "attention",
  SIGNED: "positive",
  EXPIRED: "neutral",
  DECLINED: "negative",
  VOIDED: "negative",
  ARCHIVED: "neutral",
};

// Plain-language names. Forms are filled in at the studio, so "SENT" means ready but not opened yet.
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  SENT: "Not started",
  VIEWED: "Opened",
  IN_PROGRESS: "Filling in",
  SIGNED: "Signed",
  EXPIRED: "Expired",
  DECLINED: "Declined",
  VOIDED: "Voided",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
