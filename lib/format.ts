import type { Token } from './types';

export function formatNumber(n: number, maxFrac = 6) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

export function toBaseUnits(amountStr: string, decimals: number): string {
  // Normalize string
  const [intPartRaw, fracPartRaw = ''] = amountStr.trim().split('.');
  const intPart = intPartRaw.replace(/\D/g, '') || '0';
  const fracPart = fracPartRaw.replace(/\D/g, '').slice(0, decimals);
  const paddedFrac = fracPart.padEnd(decimals, '0');
  const base = (intPart + paddedFrac).replace(/^0+/, '') || '0';
  return base;
}

export function fromBaseUnits(amountBase: string, decimals: number): number {
  const neg = amountBase.startsWith('-');
  const s = neg ? amountBase.slice(1) : amountBase;
  const padded = s.padStart(decimals + 1, '0');
  const int = padded.slice(0, -decimals) || '0';
  const frac = padded.slice(-decimals).replace(/0+$/, '');
  const num = Number(`${neg ? '-' : ''}${int}${frac ? '.' + frac : ''}`);
  return Number.isFinite(num) ? num : 0;
}

export function calcMinReceived(
  toAmountBase?: string,
  toAmountMinBase?: string,
  decimals?: number,
  slippagePct?: number,
): { minRaw: string; min: number } | undefined {
  if (!decimals) return undefined;
  if (toAmountMinBase) {
    return { minRaw: toAmountMinBase, min: fromBaseUnits(toAmountMinBase, decimals) };
  }
  if (!toAmountBase) return undefined;
  const toAmountNum = fromBaseUnits(toAmountBase, decimals);
  const sl = typeof slippagePct === 'number' ? slippagePct : 0.5;
  const min = toAmountNum * (1 - sl / 100);
  // Convert back to base (string), then return both
  const minRaw = toBaseUnits(min.toString(), decimals);
  return { minRaw, min };
}

export function tokenLogoUrl(token?: Token): string | undefined {
  return token?.logoURI;
}
