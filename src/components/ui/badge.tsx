import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-stone-100 text-stone-700",
  positive: "bg-emerald-100 text-emerald-800",
  attention: "bg-amber-100 text-amber-800",
  negative: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}
