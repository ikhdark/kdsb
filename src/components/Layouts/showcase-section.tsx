import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function ShowcaseSection({ title, children, className }: Props) {
  return (
    <section
      className={cn(
        "rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card",
        className
      )}
    >
      <h2 className="border-b border-stroke px-4 py-4 font-medium text-dark dark:border-dark-3 dark:text-white sm:px-6 xl:px-7.5">
        {title}
      </h2>

      <div className="p-4 sm:p-6 xl:p-10">
        {children}
      </div>
    </section>
  );
}
