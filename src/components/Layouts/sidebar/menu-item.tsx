"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type MenuItemProps = {
  children: React.ReactNode;
  isActive?: boolean;
  as?: "link" | "button";
  href?: string;
  onClick?: () => void;
};

export default function MenuItem({
  children,
  isActive,
  as = "button",
  href,
  onClick,
}: MenuItemProps) {
  const classes = cn(
    "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium",
    isActive
      ? "bg-primary text-white"
      : "text-dark hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
  );

  if (as === "link" && href) {
    return (
      <Link href={href} className={classes}>
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
