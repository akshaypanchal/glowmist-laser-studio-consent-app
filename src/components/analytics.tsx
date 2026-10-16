// Vercel Web Analytics (page views only), added once in the root layout. Every event's URL is cleaned first so signing tokens never reach Vercel.

"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { redactAnalyticsUrl } from "@/lib/redact-analytics-url";

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return { ...event, url: redactAnalyticsUrl(event.url) };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={beforeSend} />;
}
