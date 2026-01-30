"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MenuItemProps = {
  children: ReactNode;
  isActive?: boolean;
  as?: "link" | "button";
  href?: string;
  onClick?: () => void;
  className?: string; // ✅ add
};

export default function MenuItem({
  children,
  isActive = false,
  as = "button",
  href,
  onClick,
  className, // ✅ receive
}: MenuItemProps) {
  const classes = cn(
    "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
    "text-dark dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800",
    isActive ? "bg-primary text-white hover:bg-primary" : "",
    className // ✅ merge
  );

  if (as === "link" && href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
