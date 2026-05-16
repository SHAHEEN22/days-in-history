import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import Anthropic from '@anthropic-ai/sdk';

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!
});

interface DailyEvent {
  headline: string;
  summary: string;
  year: number;
  category: 'warfare' | 'politics' | 'religion' | 'science' | 'arts' | 'exploration' | 'trade' | 'architecture';
  displayDate: string;
  region: 'europe' | 'middle_east' | 'east_asia' | 'south_asia';
  tags: string[];
  generatedAt: string;
}

interface WikipediaEvent {
  text: string;
  year: number;
  pages?: Array<{ title: string; extract?: string }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Curated fallback events spanning all regions and categories (pre-1918)
const FALLBACK_EVENTS: Array<Omit<DailyEvent, 'displayDate' | 'generatedAt'>> = [
  {
    headline: "Julius Caesar crosses the Rubicon, triggering Roman civil war",
    summary: "In 49 BCE, Julius Caesar led his army across the Rubicon River into Italy, defying the Roman Senate's order to disband his forces. This illegal act sparked a devastating civil war between Caesar and Pompey. Caesar's eventual victory would transform the Roman Republic into an autocratic empire, ending 500 years of republican government.",
    year: -49, category: 'warfare', region: 'europe', tags: ['rome', 'civil-war']
  },
  {
    headline: "Fall of Constantinople ends the Byzantine Empire after eleven centuries",
    summary: "On May 29, 1453, Ottoman Sultan Mehmed II's forces breached the ancient walls of Constantinople after a 53-day siege, ending the Byzantine Empire. The last emperor, Constantine XI, died fighting on the walls. The conquest sent shockwaves through Christian Europe and signaled the definitive end of the Roman world.",
    year: 1453, category: 'warfare', region: 'europe', tags: ['byzantium', 'ottoman']
  },
  {
    headline: "Mongols sack Baghdad and execute the last Abbasid Caliph",
    summary: "In February 1258, Hulagu Khan's Mongol forces captured and destroyed Baghdad, the jewel of the Islamic world for five centuries. The last Abbasid Caliph Al-Musta'sim was executed, and hundreds of thousands perished. The city's legendary libraries and irrigation networks were destroyed, a catastrophe from which the region took centuries to recover.",
    year: 1258, category: 'warfare', region: 'middle_east', tags: ['mongol', 'abbasid']
  },
  {
    headline: "Emperor Ashoka converts to Buddhism after the bloody Kalinga War",
    summary: "Around 261 BCE, the Mauryan Emperor Ashoka was so horrified by the 100,000 deaths of the Kalinga War that he converted to Buddhism and renounced warfare. He then devoted his reign to spreading the dharma across his vast empire. His edicts, carved on pillars across the subcontinent, represent the first recorded example of a ruler codifying non-violence.",
    year: -261, category: 'religion', region: 'south_asia', tags: ['ashoka', 'buddhism']
  },
  {
    headline: "Tang Dynasty founded, inaugurating China's golden age of culture",
    summary: "In 618 CE, Li Yuan declared himself emperor after the collapse of the short-lived Sui Dynasty, founding the Tang Dynasty. The Tang period became a golden age of Chinese civilization marked by territorial expansion, flourishing poetry and art, and the Silk Road reaching its height. Tang China became the most cosmopolitan empire in the world, attracting merchants from Persia to Japan.",
    year: 618, category: 'politics', region: 'east_asia', tags: ['tang', 'china']
  },
  {
    headline: "Gutenberg's Bible printed in Mainz, transforming the flow of knowledge",
    summary: "Around 1455, Johannes Gutenberg completed printing his 42-line Bible in Mainz, using his revolutionary movable-type press. The technology made books affordable for the first time, shattering the Church's monopoly on literacy. Within 50 years over 20 million books had been printed across Europe, directly fueling the Renaissance, Reformation, and Scientific Revolution.",
    year: 1455, category: 'science', region: 'europe', tags: ['printing', 'gutenberg']
  },
  {
    headline: "Battle of Marathon: Athens halts the first Persian invasion of Greece",
    summary: "In 490 BCE, an Athenian force of roughly 10,000 men routed a Persian army of 25,000 at Marathon, saving Greek civilization from conquest. The victory preserved Athenian democracy at its most fragile moment.",
    year: -490, category: 'warfare', region: 'europe', tags: ['greece', 'persia']
  },
  {
    headline: "Vasco da Gama reaches India, breaking the Muslim monopoly on the spice trade",
    summary: "In May 1498, Portuguese navigator Vasco da Gama arrived at Calicut on India's Malabar Coast after rounding the Cape of Good Hope. The achievement shattered the Venetian-Muslim monopoly on the lucrative spice trade and redirected global commerce.",
    year: 1498, category: 'exploration', region: 'south_asia', tags: ['exploration', 'spice-trade']
  },
  {
    headline: "Genghis Khan unifies the Mongol tribes and launches the world's greatest conquest",
    summary: "In 1206, Temujin was proclaimed Genghis Khan at a great kurultai of Mongol tribes he had unified through a decade of brutal warfare. He reorganized the army on meritocratic lines and issued a universal law code. Within two decades his forces would create the largest contiguous empire in history.",
    year: 1206, category: 'politics', region: 'east_asia', tags: ['mongol', 'genghis-khan']
  },
  {
    headline: "Akbar the Great extends Mughal rule across the Indian subcontinent",
    summary: "By 1600, the Mughal Emperor Akbar had extended his empire to encompass most of the Indian subcontinent through military conquest and shrewd diplomacy. He pursued a policy of radical religious tolerance, incorporating Hindu Rajput princes into his administration.",
    year: 1600, category: 'politics', region: 'south_asia', tags: ['mughal', 'akbar']
  },
  {
    headline: "Battle of Hastings: William the Conqueror seizes the English crown",
    summary: "On October 14, 1066, Norman Duke William defeated King Harold II at Hastings, ending Anglo-Saxon rule in England. The Norman Conquest fundamentally transformed English language, law, and feudal organization.",
    year: 1066, category: 'warfare', region: 'europe', tags: ['normans', 'england']
  },
  {
    headline: "First Crusade captures Jerusalem after a brutal siege and massacre",
    summary: "On July 15, 1099, Crusader forces captured Jerusalem after a 40-day siege, massacring thousands of the city's Muslim and Jewish inhabitants. The conquest established the Latin Kingdom of Jerusalem.",
    year: 1099, category: 'religion', region: 'middle_east', tags: ['crusades', 'jerusalem']
  },
  {
    headline: "Saladin recaptures Jerusalem, ending 88 years of Crusader rule",
    summary: "On October 2, 1187, the Kurdish sultan Saladin recaptured Jerusalem from the Crusaders after the decisive Battle of Hattin. Unlike the bloody Crusader conquest of 1099, Saladin allowed Christian residents to leave safely.",
    year: 1187, category: 'warfare', region: 'middle_east', tags: ['saladin', 'crusades']
  },
  {
    headline: "Hagia Sophia dedicated in Constantinople as the world's largest cathedral",
    summary: "In 537 CE, Byzantine Emperor Justinian I dedicated the Hagia Sophia in Constantinople — the largest cathedral in the world for nearly 1,000 years. Its massive dome was an engineering marvel that no other builder could replicate for a millennium.",
    year: 537, category: 'architecture', region: 'europe', tags: ['hagia-sophia', 'byzantine']
  },
  {
    headline: "Han Emperor Wu establishes the Silk Road, linking China with the West",
    summary: "Around 130 BCE, Han Emperor Wu established the Silk Road trade routes after Zhang Qian's pioneering diplomatic missions to Central Asia. This network linked China with Rome, facilitating the exchange of silk, spices, and ideas across thousands of miles.",
    year: -130, category: 'trade', region: 'east_asia', tags: ['silk-road', 'han-china']
  },
  {
    headline: "Marco Polo departs Venice on his epic 24-year journey to China",
    summary: "In 1271, seventeen-year-old Marco Polo set out from Venice on an overland journey to the court of Kublai Khan. His account, Il Milione, introduced Europeans to the wealth of Asian civilizations.",
    year: 1271, category: 'exploration', region: 'europe', tags: ['marco-polo', 'silk-road']
  }
];

function getDateKey(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}${dd}`;
}

function getMMDD(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}${dd}`;
}

function getDisplayDate(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

async function getRecentHistory(today: Date): Promise<{ tags: string[]; regions: string[] }> {
  const recentTags: string[] = [];
  const recentRegions: string[] = [];

  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = getDateKey(d);
    const event = await kv.get<DailyEvent>(`event:${key}`);
    if (event) {
      recentTags.push(...(event.tags ?? []));
      if (i <= 7) recentRegions.push(event.region);
    }
  }

  return {
    tags: [...new Set(recentTags)],
    regions: [...new Set(recentRegions)]
  };
}

async function fetchWikipediaEvents(month: number, day: number): Promise<string> {
  try {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DaysInHistory/1.0 (https://days-in-history.vercel.app; shaheen.chaudhri@gmail.com)',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return '';
    const data = await res.json() as { events?: WikipediaEvent[] };
    if (!data.events || data.events.length === 0) return '';

    // Filter to pre-1918 events and format them
    const ancient = data.events
      .filter(e => e.year < 1918)
      .sort((a, b) => a.year - b.year)
      .slice(0, 30);

    if (ancient.length === 0) return '';

    return ancient
      .map(e => {
        const extracts = (e.pages ?? [])
          .filter(p => p.extract)
          .map(p => p.extract)
          .join(' ');
        const extra = extracts ? ` — ${extracts.slice(0, 200)}` : '';
        return `${e.year}: ${e.text}${extra}`;
      })
      .join('\n');
  } catch {
    return '';
  }
}

async function callClaude(
  anthropic: Anthropic,
  date: Date,
  wikiEvents: string,
  excludedTags: string[],
  excludedRegions: string[]
): Promise<DailyEvent | null> {
  const monthName = MONTH_NAMES[date.getUTCMonth()];
  const dayNum = date.getUTCDate();

  const systemContent = `You are a historian generating content for a "Days in History" website.

STRICT RULES — follow all of these exactly:
- Only select events from before 1918 CE
- Only cover these regions: Europe (Greece, Rome, Byzantium, Western/Central Europe, Scandinavia, Russia), Middle East (Mesopotamia, Persia, Arabia, Levant, Ottoman Empire, Islamic caliphates), East Asia (primarily China and Japan, Korea where relevant), South Asia (Indian subcontinent: Maurya, Gupta, Chola, Delhi Sultanate, Mughal Empire)
- Do NOT select events from the Americas, sub-Saharan Africa, or post-WW1 history
- Prefer events that actually occurred on or near this specific date
- Prefer lesser-known but fascinating events over the most famous ones everyone already knows
- Always respond with valid JSON only, never conversational text`;

  const tagNote = excludedTags.length > 0
    ? `\nRecently featured topics — avoid these: ${excludedTags.join(', ')}`
    : '';
  const regionNote = excludedRegions.length > 0
    ? `\nRecently featured regions — prefer a different one: ${excludedRegions.join(', ')}`
    : '';

  const sourceSection = wikiEvents
    ? `Wikipedia records these events for ${monthName} ${dayNum}:\n${wikiEvents}\n\nChoose one of these events that fits the regional constraints, or use your own knowledge if none fit.`
    : `No Wikipedia data available. Use your knowledge of pre-1918 world history to find a notable event from ${monthName} ${dayNum}.`;

  const userContent = `Today's date: ${monthName} ${dayNum}

${sourceSection}
${tagNote}${regionNote}

Select ONE fascinating historical event that occurred on or near ${monthName} ${dayNum}.

Return ONLY valid JSON with this exact structure — no other text before or after:
{
  "headline": "max 15 words, punchy description of the event",
  "summary": "3-5 sentences explaining what happened and why it mattered historically. Be vivid and specific.",
  "year": <integer — negative for BCE e.g. -44 for 44 BCE, positive for CE>,
  "category": "<exactly one of: warfare, politics, religion, science, arts, exploration, trade, architecture>",
  "region": "<exactly one of: europe, middle_east, east_asia, south_asia>",
  "tags": ["lowercase-tag-1", "lowercase-tag-2"]
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      {
        type: 'text' as const,
        text: systemContent,
        cache_control: { type: 'ephemeral' as const }
      }
    ],
    messages: [{ role: 'user', content: userContent }]
  });

  const block = msg.content[0];
  if (block.type !== 'text') return null;

  const jsonMatch = block.text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as {
    headline: string;
    summary: string;
    year: number;
    category: DailyEvent['category'];
    region: DailyEvent['region'];
    tags: string[];
  };

  return {
    headline: parsed.headline,
    summary: parsed.summary,
    year: Number(parsed.year),
    category: parsed.category,
    displayDate: getDisplayDate(date),
    region: parsed.region,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).toLowerCase()) : [],
    generatedAt: new Date().toISOString()
  };
}

async function generateForDate(date: Date, anthropic: Anthropic): Promise<DailyEvent> {
  const { tags: recentTags, regions: recentRegions } = await getRecentHistory(date);
  const monthNum = date.getUTCMonth() + 1;
  const dayNum = date.getUTCDate();

  let wikiEvents = '';
  try {
    wikiEvents = await fetchWikipediaEvents(monthNum, dayNum);
  } catch {
    /* continue without Wikipedia data */
  }

  let excludedTags = [...recentTags];
  let excludedRegions = [...recentRegions];
  let event: DailyEvent | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const candidate = await callClaude(anthropic, date, wikiEvents, excludedTags, excludedRegions);
      if (!candidate) continue;

      // On the last attempt, accept even if there's a collision
      if (attempt < 3) {
        const tagCollision = candidate.tags.some(t => excludedTags.includes(t));
        const regionCollision = excludedRegions.includes(candidate.region);
        if (tagCollision || regionCollision) {
          excludedTags = [...new Set([...excludedTags, ...candidate.tags])];
          excludedRegions = [...new Set([...excludedRegions, candidate.region])];
          continue;
        }
      }

      event = candidate;
      break;
    } catch (err) {
      console.error(`Attempt ${attempt} failed for ${getDateKey(date)}:`, err);
    }
  }

  // Deterministic fallback so the site never shows empty
  if (!event) {
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(Date.UTC(date.getUTCFullYear(), 0, 0)).getTime()) / 86_400_000
    );
    event = {
      ...FALLBACK_EVENTS[dayOfYear % FALLBACK_EVENTS.length],
      displayDate: getDisplayDate(date),
      generatedAt: new Date().toISOString()
    };
  }

  return event;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    const secretQuery = req.query.secret as string | undefined;
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      secretQuery === cronSecret;
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const force = req.query.force === 'true';
  const dateParam = req.query.date as string | undefined;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Determine which dates to generate for
  let datesToGenerate: Date[];
  if (dateParam) {
    // Accept MMDD or YYYY-MM-DD
    if (/^\d{4}$/.test(dateParam)) {
      const mm = parseInt(dateParam.slice(0, 2), 10) - 1;
      const dd = parseInt(dateParam.slice(2, 4), 10);
      const now = new Date();
      datesToGenerate = [new Date(Date.UTC(now.getUTCFullYear(), mm, dd))];
    } else {
      datesToGenerate = [new Date(dateParam)];
    }
  } else {
    // Generate today + next 2 days (pre-cache)
    const today = new Date();
    datesToGenerate = [0, 1, 2].map(offset => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
      return d;
    });
  }

  const results: Array<{ date: string; status: string; headline?: string }> = [];

  for (const date of datesToGenerate) {
    const dateKey = getDateKey(date);

    if (!force) {
      const existing = await kv.get(`event:${dateKey}`);
      if (existing) {
        results.push({ date: dateKey, status: 'already_exists' });
        continue;
      }
    }

    try {
      const event = await generateForDate(date, anthropic);
      await kv.set(`event:${dateKey}`, event);
      results.push({ date: dateKey, status: 'generated', headline: event.headline });
    } catch (err) {
      console.error(`Failed to generate for ${dateKey}:`, err);
      results.push({ date: dateKey, status: 'error' });
    }
  }

  return res.status(200).json({ results });
}

