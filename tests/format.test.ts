import { describe, it, expect } from 'vitest';
import { toBaseUnits, fromBaseUnits, calcMinReceived } from '@/lib/format';

describe('format helpers', () => {
  it('toBaseUnits and fromBaseUnits round-trip', () => {
    const s = '1.2345';
    const base = toBaseUnits(s, 6);
    expect(fromBaseUnits(base, 6)).toBeCloseTo(1.2345, 6);
  });

  it('calcMinReceived computes slippage min when toAmountMin missing', () => {
    const res = calcMinReceived('1000000', undefined, 6, 1);
    expect(res?.min).toBeCloseTo(0.99, 6);
  });
});
