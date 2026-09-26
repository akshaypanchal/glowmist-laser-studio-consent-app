// White bordered box used to group content on dashboard pages.

import { cn } from "@/lib/cn";

export function Card({ className, padded = true, ...props }: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cn("rounded-lg border border-stone-200 bg-white shadow-sm", padded && "p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("mb-4 text-lg font-semibold text-stone-900", className)} {...props} />;
}
