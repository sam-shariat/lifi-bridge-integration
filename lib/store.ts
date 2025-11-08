"use client";
import { create } from 'zustand';
import type { Token } from './types';

type BridgeState = {
  fromChainId?: number;
  toChainId?: number;
  fromToken?: Token;
  toToken?: Token;
  amount: string; // human-readable, e.g. "1.23"
  slippage: number; // percent
  set<K extends keyof BridgeState>(key: K, value: BridgeState[K]): void;
  reset(): void;
};

export const useBridgeStore = create<BridgeState>((set) => ({
  amount: '',
  slippage: 0.5,
  set: (key, value) => set((state) => ({ ...(state as BridgeState), [key]: value } as BridgeState)),
  reset: () => set({ fromChainId: undefined, toChainId: undefined, fromToken: undefined, toToken: undefined, amount: '', slippage: 0.5 }),
}));
