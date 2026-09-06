import { quoteProxyHops } from "./quote-proxy";
describe("explicit trusted proxy hops", () => {
  it("does not trust forwarded IP headers by default", () => {
    expect(quoteProxyHops(undefined)).toBeUndefined();
    expect(quoteProxyHops("")).toBeUndefined();
  });
  it("allows explicit bounded deployment hop count and rejects broad trust", () => {
    expect(quoteProxyHops("1")).toBe(1);
    for (const value of ["true", "0", "6", "1.5", "Infinity", "1evil"])
      expect(() => quoteProxyHops(value)).toThrow();
  });
});
