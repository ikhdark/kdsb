import { cn } from "@/lib/utils";
import React, { forwardRef } from "react";

export const Skeleton = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Skeleton({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        // baseline so it's visible even without sizing
        "animate-pulse rounded-md bg-neutral-100 dark:bg-dark-2",
        "min-h-[1rem] min-w-[1rem]",
        className
      )}
      {...props}
    />
  );
});
