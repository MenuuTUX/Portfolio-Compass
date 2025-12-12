import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');
  const queryParams = new URLSearchParams(searchParams);
  queryParams.delete('path'); // Remove the path parameter, keep the rest

  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  const apiKey = process.env.COINGECKO_API_KEY;

  try {
    const url = `${COINGECKO_BASE_URL}/${path}?${queryParams.toString()}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (apiKey) {
      headers['x-cg-demo-api-key'] = apiKey;
    }

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Upstream error: ${response.status} ${response.statusText}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
