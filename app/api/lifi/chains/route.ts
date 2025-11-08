import { NextResponse } from 'next/server';
import { buildHeaders, getApiBase } from '@/app/api/lifi/_utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${getApiBase()}/chains`, {
      headers: buildHeaders(),
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch chains';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
