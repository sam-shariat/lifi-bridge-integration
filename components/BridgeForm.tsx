"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBridgeStore } from '@/lib/store';
import type { Chain, Token, QuoteResponse } from '@/lib/types';
import { calcMinReceived, formatNumber, toBaseUnits, fromBaseUnits } from '@/lib/format';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain, useWalletClient, usePublicClient } from 'wagmi';
import type { Hex } from 'viem';

const ERC20_ABI = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

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

// Fetch tokens for a single chain, flattening LI.FI response { tokens: { chainId: Token[] } }
function useTokens(chainId?: number) {
  return useQuery<{ tokens: Token[] }>({
    queryKey: ['tokens', chainId],
    enabled: !!chainId,
    // Avoid retry storms on 404/429; don't refetch on focus to reduce noise
    retry: (failureCount, error) => {
      const msg = String(error);
      if (msg.includes('404') || msg.includes('429')) return false;
      return failureCount < 2; // small retry for transient network issues
    },
    refetchOnWindowFocus: false,
    // Normalize to always return { tokens: Token[] } and swallow non-OK as empty
    queryFn: async () => {
      // Helper to normalize any of the observed shapes into Token[] for a chainId
      const normalize = (raw: unknown): Token[] => {
        if (!raw || typeof raw !== 'object') return [];
        const root = raw as Record<string, unknown>;
        if (Array.isArray(root['tokens'])) return root['tokens'] as Token[]; // direct array form
        const nested = root['tokens'];
        if (nested && typeof nested === 'object') {
          const rec = nested as Record<string, unknown>;
            const direct = rec[String(chainId)];
            if (Array.isArray(direct)) return direct as Token[];
            const all = Object.values(rec).filter(Array.isArray) as Token[][];
            if (all.length) return all.flat();
        }
        // Legacy flat mapping { "1": [...], "137": [...] }
        const flatArrays = Object.values(root).filter(Array.isArray) as Token[][];
        if (flatArrays.length) return flatArrays.flat().filter(t => t.chainId === chainId);
        return [];
      };
      // First attempt: restricted fetch
      try {
        const withChain = await fetch(`/api/lifi/tokens?chains=${chainId}`, { headers: { accept: 'application/json' } });
        if (withChain.ok) {
          const data = await withChain.json();
          return { tokens: normalize(data) };
        }
        // If 404/1003, fall back to full set
      } catch { /* swallow */ }
      try {
        const full = await fetch(`/api/lifi/tokens`, { headers: { accept: 'application/json' } });
        if (full.ok) {
          const data = await full.json();
          return { tokens: normalize(data) };
        }
      } catch { /* swallow */ }
      return { tokens: [] };
    },
    staleTime: 60_000,
  });
}

function useQuote() {
  const { fromChainId, toChainId, fromToken, toToken, amount, slippage } = useBridgeStore();
  const { address } = useAccount();
  return useQuery<QuoteResponse>({
    queryKey: ['quote', fromChainId, toChainId, fromToken?.address, toToken?.address, amount, slippage],
    enabled: Boolean(fromChainId && toChainId && fromToken && toToken && amount && Number(amount) > 0),
    queryFn: async () => {
      const fromAmount = toBaseUnits(amount, fromToken!.decimals);
      const params = new URLSearchParams({
        // LI.FI v1/quote expects these names
        fromChain: String(fromChainId!),
        toChain: String(toChainId!),
        fromToken: fromToken!.address,
        toToken: toToken!.address,
        fromAmount,
        // API expects decimal fraction (0-1); our UI stores percent
        slippage: String((slippage ?? 0.5) / 100),
        // Some providers require it; zero-address fallback if disconnected
        fromAddress: address ?? '0x0000000000000000000000000000000000000000',
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
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();

  const needsApproval = useMemo(() => {
    const spender = quote.data?.estimate?.approvalAddress;
    const isNative = fromToken?.address === '0x0000000000000000000000000000000000000000' || fromToken?.address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    return Boolean(spender && fromToken && !isNative);
  }, [quote.data, fromToken]);

  // Helpers
  const parseHexOrDecToBigInt = (v?: string): bigint | undefined => {
    if (!v) return undefined;
    try {
      if (v.startsWith('0x') || v.startsWith('0X')) return BigInt(v);
      return BigInt(v);
    } catch {
      return undefined;
    }
  };

  const onApprove = async () => {
    if (!walletClient || !publicClient || !fromToken) return;
    const spender = quote.data?.estimate?.approvalAddress as `0x${string}` | undefined;
    const amountBase = quote.data?.estimate?.fromAmount || quote.data?.fromAmount || amount ? toBaseUnits(amount, fromToken.decimals) : undefined;
    if (!spender || !amountBase) return;
    try {
      if (currentChainId !== fromChainId && switchChainAsync && fromChainId) {
        await switchChainAsync({ chainId: fromChainId });
      }
      setApproving(true);
      setTxHash(undefined);
      const hash = await walletClient.writeContract({
        address: fromToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, BigInt(amountBase)],
        chain: undefined,
        account: walletClient.account,
      });
      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });
      setApproved(true);
      setTxHash(hash);
    } catch (e) {
      console.error('Approve failed', e);
    } finally {
      setApproving(false);
    }
  };

  const onBridge = async () => {
    if (!walletClient) return;
    const tx = quote.data?.transactionRequest as {
      to?: string;
      data?: Hex;
      value?: string;
      gasPrice?: string;
      gasLimit?: string;
      chainId?: number;
    } | undefined;
    if (!tx || !tx.to) return;
    try {
      // Ensure on correct chain
      if (currentChainId !== fromChainId && switchChainAsync && fromChainId) {
        await switchChainAsync({ chainId: fromChainId });
      }
      setBridging(true);
      setTxHash(undefined);
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as Hex | undefined,
        value: parseHexOrDecToBigInt(tx.value),
        // gas & gasPrice are optional; wallet/provider will estimate if omitted
        account: walletClient.account,
      });
      setTxHash(hash);
    } catch (e) {
      console.error('Bridge tx failed', e);
    } finally {
      setBridging(false);
    }
  };

  // Select defaults once chains load
  useEffect(() => {
    if (!chains || chains.length === 0) return;
    // Only set defaults once when both are unset to avoid flip-flopping
    if (!fromChainId && !toChainId) {
      const fromDefault = chains.find((c) => c.name.toLowerCase().includes('ethereum'))?.id ?? chains[0].id;
      const toDefault = chains.find((c) => c.name.toLowerCase().includes('polygon'))?.id ?? chains[1]?.id ?? chains[0].id;
      set('fromChainId', fromDefault);
      set('toChainId', toDefault);
    }
  }, [chains, fromChainId, toChainId, set]);

  // Reset tokens when chains change
  useEffect(() => { set('fromToken', undefined); }, [fromChainId, set]);
  useEffect(() => { set('toToken', undefined); }, [toChainId, set]);

  const feeDisplay = useMemo(() => {
    const feeCosts = quote.data?.estimate?.feeCosts;
    if (!feeCosts || feeCosts.length === 0) return '-';
    // Sum USD values if present, otherwise sum raw token amounts of first token symbol
    const usdTotal = feeCosts.reduce((acc, f) => acc + (f.amountUSD ? Number(f.amountUSD) : 0), 0);
    if (usdTotal > 0) return `$${formatNumber(usdTotal, 4)} total fees`;
    const token = feeCosts[0]?.token?.symbol;
    const rawTotal = feeCosts.reduce((acc, f) => acc + (f.amount ? Number(f.amount) : 0), 0);
    if (rawTotal > 0 && token) return `${rawTotal} ${token} fees`;
    return feeCosts[0]?.name ?? '-';
  }, [quote.data]);

  const timeDisplay = useMemo(() => {
    const sec = quote.data?.estimate?.executionDuration;
    if (!sec) return '-';
    const m = Math.ceil(sec / 60);
    return `${m} min`;
  }, [quote.data]);

  const minReceived = useMemo(() => {
    if (!toToken) return '-';
    // Prefer estimate.toAmountMin directly if provided (already includes slippage guarantee)
    const toAmountMinBase = quote.data?.estimate?.toAmountMin || quote.data?.toAmountMin;
    if (toAmountMinBase) {
      const r = calcMinReceived(undefined, toAmountMinBase, toToken.decimals, slippage);
      return `${formatNumber(r!.min)} ${toToken.symbol}`;
    }
    const r = calcMinReceived(quote.data?.estimate?.toAmount || quote.data?.toAmount, undefined, toToken.decimals, slippage);
    if (!r) return '-';
    return `${formatNumber(r.min)} ${toToken.symbol}`;
  }, [quote.data, toToken, slippage]);

  const estimatedReceived = useMemo(() => {
    if (!toToken) return '-';
    const base = quote.data?.estimate?.toAmount || quote.data?.toAmount;
    if (!base) return '-';
    const num = fromBaseUnits(base, toToken.decimals);
    return `${formatNumber(num)} ${toToken.symbol}`;
  }, [quote.data, toToken]);

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

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 pt-2">
          <div>
            <div className="text-xs text-zinc-500">Estimated Fee</div>
            <div className="text-sm font-medium">{feeDisplay}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Time Estimate</div>
            <div className="text-sm font-medium">{timeDisplay}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Estimated Received</div>
            <div className="text-sm font-medium">{estimatedReceived}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Minimum Received</div>
            <div className="text-sm font-medium">{minReceived}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Quote Details</div>
            <div className="text-xs leading-tight max-h-12 overflow-hidden">
              {quote.data?.toolDetails?.name && (
                <span className="inline-block mr-1">Tool: {quote.data.toolDetails.name}</span>
              )}
              {quote.data?.estimate?.approvalAddress && (
                <span className="inline-block mr-1">Approval: {quote.data.estimate.approvalAddress.slice(0,6)}…</span>
              )}
              {quote.data?.estimate?.fromAmountUSD && quote.data?.estimate?.toAmountUSD && (
                <span className="inline-block">ΔUSD: {formatNumber(Number(quote.data.estimate.fromAmountUSD) - Number(quote.data.estimate.toAmountUSD), 4)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {needsApproval && (
            <button
              className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              disabled={approving || approved || !quote.data}
              onClick={onApprove}
            >
              {approving ? 'Approving…' : approved ? 'Approved' : 'Approve'}
            </button>
          )}
          <button
            className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={bridging || !quote.data}
            onClick={onBridge}
          >
            {currentChainId !== fromChainId ? `Switch to ${chains?.find(c => c.id === fromChainId)?.name ?? 'source chain'}` : (bridging ? 'Bridging…' : 'Bridge')}
          </button>
          {txHash && (
            <a className="text-xs text-blue-600 underline" href={`https://explorer.li.fi/tx/${txHash}`} target="_blank" rel="noreferrer">
              View Tx
            </a>
          )}
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
