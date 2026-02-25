import { type NextRequest } from 'next/server';

const CLICKHOUSE = 'http://clickhouse:8123';

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const adminPw = process.env.ADMIN_PASSWORD ?? '';
  if (!adminPw) return Response.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 503 });

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${adminPw}`) return unauthorized();

  const days = Number(req.nextUrl.searchParams.get('days') ?? '30');

  const query = `
    SELECT
      formatDateTime(Timestamp, '%Y-%m-%d %H:%i:%S') AS ts,
      SpanAttributes['page.path']                     AS path,
      SpanAttributes['page.title']                    AS title,
      SpanAttributes['page.referrer']                 AS referrer,
      SpanAttributes['viewport.width']                AS vp_w,
      SpanAttributes['viewport.height']               AS vp_h,
      round(Duration / 1e9, 1)                        AS seconds,
      ResourceAttributes['browser.user_agent']        AS ua,
      ResourceAttributes['browser.timezone']          AS tz,
      ResourceAttributes['browser.language']          AS lang,
      ResourceAttributes['browser.screen_width']      AS sw,
      ResourceAttributes['browser.screen_height']     AS sh,
      ResourceAttributes['browser.device_pixel_ratio'] AS dpr,
      ResourceAttributes['browser.platform']          AS platform
    FROM otel_traces
    WHERE ServiceName = 'o11y-news-browser'
      AND SpanName = 'page.view'
      AND Timestamp > now() - INTERVAL ${days} DAY
    ORDER BY Timestamp DESC
    LIMIT 2000
    FORMAT JSONEachRow
  `;

  try {
    const res = await fetch(`${CLICKHOUSE}/?database=otel`, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 502 });
    }

    const text = await res.text();
    const rows = text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));

    return Response.json(rows);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
