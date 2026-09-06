export function quoteProxyHops(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^[1-5]$/.test(value))
    throw new Error("TRUST_PROXY_HOPS must be an integer from 1 to 5");
  return Number(value);
}
