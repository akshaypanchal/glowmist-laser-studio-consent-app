// Formats dates and times in the studio's time zone.

export function formatDateTime(date: Date | null | undefined, timeZone = "America/Toronto") {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
}

export function formatDate(date: Date | null | undefined, timeZone = "America/Toronto") {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone }).format(date);
}
