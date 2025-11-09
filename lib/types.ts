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
  type?: string;
  tool?: string;
  toolDetails?: { key?: string; name?: string; logoURI?: string };
  estimate?: {
    tool?: string;
    approvalAddress?: string;
    toAmountMin?: string;
    fromAmount?: string;
    toAmount?: string;
    fromAmountUSD?: string;
    toAmountUSD?: string;
    feeCosts?: Array<{
      name?: string;
      description?: string;
      amount?: string;
      amountUSD?: string;
      percentage?: string;
      included?: boolean;
      token?: Token;
      feeSplit?: { integratorFee?: string; lifiFee?: string };
    }>;
    gasCosts?: Array<{
      type?: string;
      price?: string;
      estimate?: string;
      limit?: string;
      amount?: string;
      amountUSD?: string;
      token?: Token;
    }>;
    executionDuration?: number; // seconds
  };
  fromAmount?: string; // in base units
  toAmount?: string; // in base units
  toAmountMin?: string; // in base units
  toToken?: Token;
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    gasPrice?: string;
    gasLimit?: string;
    chainId?: number;
  };
};
