import { VercelRequest, VercelResponse } from '@vercel/node';

const ICONS: Record<string, string> = {
  warfare: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="4" y1="4" x2="20" y2="20"/>
  <line x1="20" y1="4" x2="4" y2="20"/>
  <polyline points="4,4 4,10 10,4"/>
  <polyline points="20,20 14,20 20,14"/>
</svg>`,

  politics: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 18 L5 9 L9 14 L12 5 L15 14 L19 9 L22 18 Z"/>
  <line x1="2" y1="18" x2="22" y2="18"/>
</svg>`,

  religion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 11 Q12 2 21 11"/>
  <rect x="3" y="11" width="18" height="2"/>
  <line x1="7" y1="13" x2="7" y2="21"/>
  <line x1="12" y1="13" x2="12" y2="21"/>
  <line x1="17" y1="13" x2="17" y2="21"/>
  <line x1="3" y1="21" x2="21" y2="21"/>
</svg>`,

  science: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="3"/>
  <line x1="12" y1="3" x2="12" y2="9"/>
  <line x1="12" y1="15" x2="12" y2="21"/>
  <line x1="3" y1="12" x2="9" y2="12"/>
  <line x1="15" y1="12" x2="21" y2="12"/>
</svg>`,

  arts: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7 3 C4 5 3 9 3 12 C3 17.5 7 22 12 22 C17 22 21 17.5 21 12 C21 9 20 5 17 3"/>
  <line x1="7" y1="3" x2="17" y2="3"/>
  <line x1="9" y1="3" x2="9" y2="18"/>
  <line x1="12" y1="3" x2="12" y2="22"/>
  <line x1="15" y1="3" x2="15" y2="18"/>
</svg>`,

  exploration: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 17 L5 13 L19 13 L21 17 Z"/>
  <path d="M5 13 L6 8 L18 8 L19 13"/>
  <line x1="12" y1="2" x2="12" y2="8"/>
  <path d="M12 2 L17.5 7 L12 8 Z"/>
  <line x1="2" y1="20" x2="22" y2="20"/>
</svg>`,

  trade: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="3" x2="12" y2="21"/>
  <line x1="5" y1="7" x2="19" y2="7"/>
  <path d="M5 7 L2 13 C2 15 3.8 16.5 6 16.5 C8.2 16.5 10 15 10 13 Z"/>
  <path d="M19 7 L22 13 C22 15 20.2 16.5 18 16.5 C15.8 16.5 14 15 14 13 Z"/>
  <line x1="9" y1="21" x2="15" y2="21"/>
</svg>`,

  architecture: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="2" width="18" height="3" rx="1"/>
  <rect x="3" y="19" width="18" height="3" rx="1"/>
  <line x1="7" y1="5" x2="7" y2="19"/>
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="17" y1="5" x2="17" y2="19"/>
</svg>`
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const category = req.query.category as string | undefined;
  if (!category || !ICONS[category]) {
    return res.status(404).send('Icon not found');
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  return res.status(200).send(ICONS[category]);
}
