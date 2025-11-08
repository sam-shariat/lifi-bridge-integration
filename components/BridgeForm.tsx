"use client";

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBridgeStore } from '@/lib/store';
import type { Chain, Token, QuoteResponse } from '@/lib/types';
import { calcMinReceived, formatNumber, toBaseUnits } from '@/lib/format';
import { ConnectButton } from '@rainbow-me/rainbowkit';

async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function useChains() {
  return useQuery<Chain[]>({
    queryKey: ['chains'],
    // The upstream may return either an array or an object like { chains: [...] } – normalize it.
    queryFn: async () => {
      const data = await fetchJSON<unknown>('/api/lifi/chains');
      if (Array.isArray(data)) return data as Chain[];
      const maybeObj = data as { chains?: unknown };
      if (Array.isArray(maybeObj?.chains)) return maybeObj.chains as Chain[];
      return [] as Chain[];
    },
    staleTime: 60_000,
  });
}

function useTokens(chainId?: number, include: 'popular' | 'all' = 'popular') {
  return useQuery<{ tokens: Token[] }>({
    queryKey: ['tokens', chainId, include],
    enabled: !!chainId,
    // Normalize to always return { tokens: Token[] }
    queryFn: async () => {
      const data = await fetchJSON<unknown>(`/api/lifi/tokens?chains=${chainId}&include=${include}`);
      if (Array.isArray(data)) return { tokens: data as Token[] };
      const maybeObj = data as { tokens?: unknown; data?: unknown };
      if (Array.isArray(maybeObj?.tokens)) return { tokens: maybeObj.tokens as Token[] };
      if (Array.isArray(maybeObj?.data)) return { tokens: maybeObj.data as Token[] };
      return { tokens: [] as Token[] };
    },
    staleTime: 60_000,
  });
}

function useQuote() {
  const { fromChainId, toChainId, fromToken, toToken, amount, slippage } = useBridgeStore();
  return useQuery<QuoteResponse>({
    queryKey: ['quote', fromChainId, toChainId, fromToken?.address, toToken?.address, amount, slippage],
    enabled: Boolean(fromChainId && toChainId && fromToken && toToken && amount && Number(amount) > 0),
    queryFn: async () => {
      const fromAmount = toBaseUnits(amount, fromToken!.decimals);
      const params = new URLSearchParams({
        fromChainId: String(fromChainId!),
        toChainId: String(toChainId!),
        fromTokenAddress: fromToken!.address,
        toTokenAddress: toToken!.address,
        fromAmount,
        slippage: String(slippage),
      });
      return fetchJSON(`/api/lifi/quote?${params.toString()}`);
    },
    refetchInterval: 30_000,
  });
}

function Select<T extends { id?: number; name?: string; symbol?: string }>(props: {
  value?: string | number;
  onChange: (val: string) => void;
  items: T[];
  getValue: (t: T) => string;
  getLabel: (t: T) => string;
  placeholder: string;
}) {
  const { value, onChange, items, getValue, getLabel, placeholder } = props;
  const list = Array.isArray(items) ? items : ([] as T[]);
  return (
    <select
      className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
      value={value !== undefined ? String(value) : ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>{placeholder}</option>
      {list.map((t, i) => (
        <option key={i} value={getValue(t)}>{getLabel(t)}</option>
      ))}
    </select>
  );
}

export default function BridgeForm() {
  const { data: chains } = useChains();
  const { fromChainId, toChainId, fromToken, toToken, amount, slippage, set } = useBridgeStore();
  const { data: fromTokens } = useTokens(fromChainId);
  const { data: toTokens } = useTokens(toChainId);
  const quote = useQuote();

  // Select defaults once chains load
  useEffect(() => {
    if (!chains || chains.length === 0) return;
    if (!fromChainId) set('fromChainId', chains.find((c) => c.name.toLowerCase().includes('ethereum'))?.id ?? chains[0].id);
    if (!toChainId) set('toChainId', chains.find((c) => c.name.toLowerCase().includes('polygon'))?.id ?? chains[1]?.id ?? chains[0].id);
  }, [chains, fromChainId, toChainId, set]);

  // Reset tokens when chains change
  useEffect(() => { set('fromToken', undefined); }, [fromChainId, set]);
  useEffect(() => { set('toToken', undefined); }, [toChainId, set]);

  const feeDisplay = useMemo(() => {
    const fees = quote.data?.estimate?.feeCosts?.filter((f) => f.amount);
    if (!fees || fees.length === 0) return '-';
    // Just sum first token if same as toToken
    const first = fees[0]!;
    return `${first.amount} ${first.token?.symbol ?? ''}`;
  }, [quote.data]);

  const timeDisplay = useMemo(() => {
    const sec = quote.data?.estimate?.executionDuration;
    if (!sec) return '-';
    const m = Math.ceil(sec / 60);
    return `${m} min`;
  }, [quote.data]);

  const minReceived = useMemo(() => {
    if (!toToken) return '-';
    const r = calcMinReceived(quote.data?.toAmount, quote.data?.toAmountMin, toToken.decimals, slippage);
    if (!r) return '-';
    return `${formatNumber(r.min)} ${toToken.symbol}`;
  }, [quote.data, toToken, slippage]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">LI.FI Bridge</h1>
        <ConnectButton showBalance={false} />
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">From Chain</label>
            <Select
              value={fromChainId ?? ''}
              onChange={(v) => set('fromChainId', Number(v))}
              items={chains ?? []}
              getValue={(c) => String(c.id)}
              getLabel={(c) => c.name}
              placeholder="Select chain"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">To Chain</label>
            <Select
              value={toChainId ?? ''}
              onChange={(v) => set('toChainId', Number(v))}
              items={chains ?? []}
              getValue={(c) => String(c.id)}
              getLabel={(c) => c.name}
              placeholder="Select chain"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">From Token</label>
            <Select
              value={fromToken?.address ?? ''}
              onChange={(v) => {
                const t = fromTokens?.tokens.find((t) => t.address === v);
                set('fromToken', t);
              }}
              items={fromTokens?.tokens ?? []}
              getValue={(t) => t.address}
              getLabel={(t) => `${t.symbol} — ${t.name}`}
              placeholder="Select token"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">To Token</label>
            <Select
              value={toToken?.address ?? ''}
              onChange={(v) => {
                const t = toTokens?.tokens.find((t) => t.address === v);
                set('toToken', t);
              }}
              items={toTokens?.tokens ?? []}
              getValue={(t) => t.address}
              getLabel={(t) => `${t.symbol} — ${t.name}`}
              placeholder="Select token"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Amount</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
              value={amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Slippage (%)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
              value={slippage}
              onChange={(e) => set('slippage', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <div className="text-xs text-zinc-500">Estimated Fee</div>
            <div className="text-sm font-medium">{feeDisplay}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Time Estimate</div>
            <div className="text-sm font-medium">{timeDisplay}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Minimum Received</div>
            <div className="text-sm font-medium">{minReceived}</div>
          </div>
        </div>

        {quote.isLoading && (
          <div className="text-xs text-zinc-500">Fetching quote…</div>
        )}
        {quote.error && (
          <div className="text-xs text-red-600">{String(quote.error)}</div>
        )}
      </div>
    </div>
  );
}
