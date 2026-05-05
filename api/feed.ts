import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!
});

interface DailyEvent {
  headline: string;
  summary: string;
  year: number;
  category: string;
  displayDate: string;
  region: string;
  tags: string[];
  generatedAt: string;
}

const RFC_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RFC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toRfcDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${RFC_DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${RFC_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} 00:00:00 +0000`;
}

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const host = req.headers.host ?? 'days-in-history.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Collect last 14 days of events
    const today = new Date();
    const items: Array<{ dateKey: string; event: DailyEvent }> = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const dateKey = `${mm}${dd}`;
      const event = await kv.get<DailyEvent>(`event:${dateKey}`);
      if (event) {
        items.push({ dateKey, event });
      }
    }

    const itemsXml = items.map(({ dateKey, event }) => {
      const link = `${baseUrl}/?date=${dateKey}`;
      const pubDate = toRfcDate(event.generatedAt ?? new Date().toISOString());
      return `    <item>
      <title>${escapeXml(`${event.headline} (${formatYear(event.year)})`)}</title>
      <description>${escapeXml(event.summary)}</description>
      <pubDate>${pubDate}</pubDate>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <category>${escapeXml(event.category)}</category>
    </item>`;
    }).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Days in History</title>
    <link>${baseUrl}</link>
    <description>One fascinating historical event each day — ancient worlds, medieval empires, early modern powers</description>
    <language>en-us</language>
    <atom:link href="${baseUrl}/api/feed" rel="self" type="application/rss+xml"/>
    <copyright>Curated by Ziggurat</copyright>
${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(rss);
  } catch (err) {
    console.error('Error in /api/feed:', err);
    return res.status(500).send('Internal server error');
  }
}
