import type { HTMLAttributes } from "react";

/* ================================= */

const CARD =
  "mx-auto max-w-xl rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 text-sm shadow-sm";

const ITEMS = [
  'Added "Live 1v1 Matches" (1.8)',
  'Added "Player Match History and Player vs Player History" (1.9)',
] as const;

/* ================================= */

export default function WhatsNew({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className ? `${CARD} ${className}` : CARD} {...props}>
      <h2 className="mb-3 font-semibold">What’s New (Beta 1.1–1.9)</h2>

      <ul className="space-y-1 text-gray-600 dark:text-gray-400">
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}