import { NextRequest, NextResponse } from 'next/server';
import { buildHeaders, forwardSearch, getApiBase } from '@/app/api/lifi/_utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = forwardSearch(getApiBase(), '/tokens', req.nextUrl.searchParams);
    const res = await fetch(url, { headers: buildHeaders(), next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch tokens';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
