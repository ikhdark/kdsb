/* -------------------- FORMATTERS (cached) -------------------- */

const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* -------------------- HELPERS -------------------- */

export function compactFormat(value: number) {
  return compactFormatter.format(value);
}

/* For counts / MMR / games */
export function standardFormat(value: number) {
  return integerFormatter.format(value);
}

/* Only use for money/ratios */
export function decimalFormat(value: number) {
  return decimalFormatter.format(value);
}
