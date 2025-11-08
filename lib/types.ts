export type Chain = {
  id: number;
  key?: string;
  name: string;
  chainType?: string;
  nativeToken?: Token;
};

export type Token = {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
};

export type QuoteResponse = {
  id?: string;
  estimate?: {
    tool?: string;
    feeCosts?: Array<{ name?: string; amount?: string; token?: Token }>;
    executionDuration?: number; // seconds
  };
  fromAmount?: string; // in base units
  toAmount?: string; // in base units
  toAmountMin?: string; // in base units
  toToken?: Token;
};
