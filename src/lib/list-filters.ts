// Helpers for the search box and date range filter on the dashboard's Clients and Documents lists.

/** Longest search text we accept; anything after this is ignored. */
const MAX_SEARCH_LENGTH = 100;

/** Trims the search text from the URL; returns undefined when there is nothing to search for. */
export function cleanSearch(value: string | string[] | undefined) {
  const text = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, MAX_SEARCH_LENGTH);
  return text || undefined;
}

/**
 * Turns search text into a SQL LIKE pattern that matches it anywhere in a column.
 * `%`, `_` and `\` are escaped so they match literally; queries using it must say `ESCAPE '\'`.
 */
export function containsPattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Reads a `YYYY-MM-DD` date from the URL; returns undefined when it is missing or not a real date. */
export function cleanDay(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? text : undefined;
}

/** How far the time zone is ahead of UTC, in milliseconds, at the given instant. */
function zoneOffset(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant midnight starts on a `YYYY-MM-DD` day in the studio's time zone. */
export function startOfStudioDay(day: string, timeZone: string) {
  const [y, m, d] = day.split("-").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  // Guess with the offset at UTC midnight, then correct once in case a daylight-saving change falls in between.
  let instant = midnightUtc - zoneOffset(new Date(midnightUtc), timeZone);
  instant = midnightUtc - zoneOffset(new Date(instant), timeZone);
  return new Date(instant);
}

/** The day after a `YYYY-MM-DD` day, in the same format. */
export function nextDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Converts a From/To day range picked on the Documents page into instants: `from` is inclusive,
 * `before` is exclusive (the midnight after the To day), so the To day itself is included.
 */
export function studioDayRange(fromDay: string | undefined, toDay: string | undefined, timeZone: string) {
  return {
    from: fromDay ? startOfStudioDay(fromDay, timeZone) : undefined,
    before: toDay ? startOfStudioDay(nextDay(toDay), timeZone) : undefined,
  };
}
