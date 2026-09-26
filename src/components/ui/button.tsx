// Shared button styles. `buttonClass()` lets links look like buttons.

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-stone-300",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:text-stone-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-stone-300",
  ghost: "text-stone-700 hover:bg-stone-100",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
    variants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
