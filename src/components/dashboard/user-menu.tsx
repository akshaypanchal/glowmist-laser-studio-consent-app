// Profile dropdown in the dashboard header: shows who is signed in and holds Settings (owner only) and Sign out, so they sit one tap away from the main tabs.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/dashboard/actions";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/server/db/schema";

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Studio Owner",
  ADMIN: "Admin",
  STAFF: "Staff",
};

const itemClass = "block w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";

export function UserMenu({ name, role, showSettings }: { name: string; role: UserRole; showSettings: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click outside the menu or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100",
          open && "bg-stone-100",
        )}
      >
        <span className="text-right leading-tight">
          <span className="block font-medium">{name}</span>
          <span className="block text-xs text-stone-500">{ROLE_LABELS[role]}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-stone-500" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {showSettings && (
            <Link role="menuitem" href="/dashboard/settings" className={itemClass} onClick={() => setOpen(false)}>
              Settings
            </Link>
          )}
          <form action={logout}>
            <button role="menuitem" type="submit" className={cn(itemClass, "text-brand-700")}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
