/** Exact rational arithmetic: amounts never pass through binary floating point.
 * Division is rounded only at the explicit serialization boundary. */
export class TenderDecimal {
  private constructor(
    readonly numerator: bigint,
    readonly denominator: bigint,
  ) {}
  static parse(value: unknown): TenderDecimal | null {
    if (typeof value !== "string" || !/^-?\d{1,30}(?:\.\d{1,18})?$/.test(value))
      return null;
    const [whole, fraction = ""] = value.split(".");
    return new TenderDecimal(
      BigInt(whole + fraction),
      10n ** BigInt(fraction.length),
    );
  }
  static integer(value: number): TenderDecimal {
    return new TenderDecimal(BigInt(value), 1n);
  }
  add(other: TenderDecimal) {
    return new TenderDecimal(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }
  subtract(other: TenderDecimal) {
    return this.add(new TenderDecimal(-other.numerator, other.denominator));
  }
  multiply(other: TenderDecimal) {
    return new TenderDecimal(
      this.numerator * other.numerator,
      this.denominator * other.denominator,
    );
  }
  divide(other: TenderDecimal) {
    if (other.numerator === 0n) throw new Error("DECIMAL_DIVISION_BY_ZERO");
    return new TenderDecimal(
      this.numerator * other.denominator,
      this.denominator * other.numerator,
    );
  }
  compare(other: TenderDecimal): number {
    const delta =
      this.numerator * other.denominator - other.numerator * this.denominator;
    return delta < 0n ? -1 : delta > 0n ? 1 : 0;
  }
  get positive(): boolean {
    return this.numerator > 0n;
  }
  toString(scale = 12, fixed = false): string {
    const negative = this.numerator < 0n;
    const scaled =
      (negative ? -this.numerator : this.numerator) * 10n ** BigInt(scale);
    const rounded = (scaled + this.denominator / 2n) / this.denominator;
    const digits = rounded.toString().padStart(scale + 1, "0");
    const fraction = scale ? digits.slice(-scale) : "";
    const tail = fixed ? fraction : fraction.replace(/0+$/, "");
    return `${negative && rounded !== 0n ? "-" : ""}${scale ? digits.slice(0, -scale) : digits}${tail ? "." + tail : ""}`;
  }
}
export const positiveDecimal = (value: unknown): TenderDecimal | null => {
  const parsed = TenderDecimal.parse(value);
  return parsed?.positive ? parsed : null;
};
