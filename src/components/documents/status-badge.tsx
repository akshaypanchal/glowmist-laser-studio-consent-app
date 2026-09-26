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

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={TONES[status]}>{status.replace("_", " ")}</Badge>;
}
