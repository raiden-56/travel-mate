/**
 * Money helpers. The API sends money as decimal strings ("1250.50").
 * We never do float arithmetic on money: values are converted to integer minor units (paise/cents)
 * as BigInt, summed, and formatted back. Display uses Intl.NumberFormat on the string.
 */

const MONEY_RE = /^-?\d+(\.\d{1,2})?$/;

export function isMoney(value: string): boolean {
  return MONEY_RE.test(value.trim());
}

export function toMinor(value: string | null | undefined): bigint {
  if (value == null || value === "") return 0n;
  const v = value.trim();
  if (!isMoney(v)) throw new Error(`Invalid money value: ${value}`);
  const negative = v.startsWith("-");
  const [whole, frac = ""] = v.replace("-", "").split(".");
  const minor = BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
  return negative ? -minor : minor;
}

export function fromMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function sumMoney(values: (string | null | undefined)[]): string {
  return fromMinor(values.reduce<bigint>((acc, v) => acc + toMinor(v), 0n));
}

export function subtractMoney(a: string, b: string): string {
  return fromMinor(toMinor(a) - toMinor(b));
}

/** Percentage of part/whole as an integer 0..100+ (for progress bars only). */
export function percentOf(part: string | null, whole: string | null): number {
  const w = toMinor(whole);
  if (w <= 0n) return 0;
  return Number((toMinor(part) * 100n) / w);
}

export function formatMoney(
  value: string | null | undefined,
  currency = "INR",
  opts: { compact?: boolean; noDecimals?: boolean } = {},
): string {
  if (value == null || value === "") return "—";
  // Intl accepts numeric strings directly (no float rounding of the source value in modern engines);
  // we pass the string to keep precision for display.
  const formatter = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.noDecimals || opts.compact ? 0 : 2,
    minimumFractionDigits: opts.noDecimals || opts.compact ? 0 : undefined,
  });
  return formatter.format(value as unknown as number);
}

export function formatMoneyRange(min: string, max: string, currency = "INR"): string {
  if (min === max) return formatMoney(min, currency, { noDecimals: true });
  return `${formatMoney(min, currency, { noDecimals: true })} – ${formatMoney(max, currency, { noDecimals: true })}`;
}
