export interface Token {
  id: string;
  name: string;
  ticker: string;
  /** Seconds since the token was created/listed. */
  ageSeconds: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  holders: number;
  txCount: number;
  /** 24h price change as a percentage, e.g. 12.5 or -4.2. */
  priceChangePct: number;
}

/** Numeric token field used to rank the feed. */
export type SortKey =
  | "marketCapUsd"
  | "volume24hUsd"
  | "priceChangePct"
  | "ageSeconds";
