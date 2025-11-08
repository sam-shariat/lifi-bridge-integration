import { NextRequest, NextResponse } from 'next/server';
import { buildHeaders, getApiBase } from '@/app/api/lifi/_utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${getApiBase()}/advanced/routes`, {
      method: 'POST',
      headers: { ...buildHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch routes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
