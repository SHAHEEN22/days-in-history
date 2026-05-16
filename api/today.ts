import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!
});

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    let dateKey: string;
    let displayDate: string;

    const dateParam = req.query.date as string | undefined;

    if (dateParam && /^\d{4}$/.test(dateParam)) {
      // Legacy MMDD format — try new key first, fall back to old
      dateKey = `${yyyy}-${dateParam}`;
      const month = parseInt(dateParam.slice(0, 2), 10) - 1;
      const day = parseInt(dateParam.slice(2, 4), 10);
      displayDate = `${MONTH_NAMES[month]} ${day}`;
    } else {
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      dateKey = `${yyyy}-${mm}${dd}`;
      displayDate = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCDate()}`;
    }

    // Try new YYYY-MMDD key first, fall back to legacy MMDD key
    let event = await kv.get(`event:${dateKey}`);
    if (!event) {
      const legacyKey = dateKey.replace(/^\d{4}-/, '');
      event = await kv.get(`event:${legacyKey}`);
    }

    if (!event) {
      return res.status(503).json({
        error: 'Content not yet generated',
        message: `No event found for ${displayDate}. Try again later or trigger /api/generate.`
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(event);
  } catch (err) {
    console.error('Error in /api/today:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

