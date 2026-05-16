import { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, unknown> = {};

  // Test 1: Check env vars
  results.hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  results.apiKeyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 10) + '...';

  // Test 2: Wikipedia API
  try {
    const wikiRes = await fetch('https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/05/15', {
      headers: { 'User-Agent': 'DaysInHistory/1.0', 'Accept': 'application/json' }
    });
    const wikiData = await wikiRes.json() as { events?: Array<{ text: string; year: number }> };
    results.wikiStatus = wikiRes.status;
    results.wikiEventCount = wikiData.events?.length ?? 0;
    results.wikiSample = wikiData.events?.slice(0, 2).map(e => e.year + ': ' + e.text.slice(0, 60));
  } catch (err) {
    results.wikiError = err instanceof Error ? err.message : String(err);
  }

  // Test 3: Claude API
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Reply with exactly: {"test":"ok"}' }]
    });
    const block = msg.content[0];
    results.claudeOk = true;
    results.claudeResponse = block.type === 'text' ? block.text.slice(0, 100) : block.type;
  } catch (err) {
    results.claudeOk = false;
    results.claudeError = err instanceof Error ? err.name + ': ' + err.message : String(err);
  }

  return res.status(200).json(results);
}
