import { NextResponse } from 'next/server';
import { buildHeaders, getApiBase } from '@/app/api/lifi/_utils';

export const dynamic = 'force-dynamic';

// Note: Endpoint naming based on docs; adjust as needed if LI.FI changes.
export async function GET() {
  try {
    const res = await fetch(`${getApiBase()}/integrators`, {
      headers: buildHeaders(),
      next: { revalidate: 300 },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch bridges/exchanges';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
