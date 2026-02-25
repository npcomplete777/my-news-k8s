import { type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.arrayBuffer();
  const ct = req.headers.get('content-type') ?? 'application/x-protobuf';
  const upstream = process.env.OTELCOL_URL ?? 'http://otelcol:4318';

  try {
    const res = await fetch(`${upstream}/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': ct },
      body,
    });
    return new Response(null, { status: res.ok ? 200 : res.status });
  } catch {
    return new Response(null, { status: 502 });
  }
}
