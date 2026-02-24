import { z } from 'zod';
import type { LLMResponse, AIPlayerView, DealerView } from '../game/types';

const LLMResponseSchema = z.object({
  thinking: z.string(),
  action: z.enum(['hit', 'stand']),
});

// Fetch with timeout
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function callGeminiFlash(
  systemPrompt: string,
  agentView: AIPlayerView | DealerView,
): Promise<LLMResponse> {
  console.log('[Gemma] Calling API...');

  // Gemma 3 27B needs a very explicit JSON-only instruction
  const userMessage = [
    systemPrompt,
    '',
    'Current game state:',
    JSON.stringify(agentView, null, 2),
    '',
    'IMPORTANT: You MUST respond with ONLY a valid JSON object, nothing else.',
    'No markdown, no explanation, no code blocks. Just raw JSON.',
    'Format: {"thinking": "<your 1-2 sentence reasoning>", "action": "<hit or stand>"}',
    'Example: {"thinking": "Dealer shows 6, my hand is 13. Dealer likely busts.", "action": "stand"}',
  ].join('\n');

  const response = await fetchWithTimeout('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.warn(`[Gemma] API error ${response.status}:`, body);
    if (response.status === 429) {
      console.warn('[Gemma] Rate limited — switching to fallback for this session');
      _geminiAvailable = false;
    }
    throw new Error(`Gemma API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('[Gemma] Raw response:', text);

  if (!text) {
    throw new Error('Empty response from Gemma');
  }

  // Extract JSON — Gemma may wrap in markdown backticks or add extra text
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemma response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Gemma might use different casing or synonyms — normalize
    const action = String(parsed.action || '').toLowerCase().trim();
    const normalizedAction = action.startsWith('hit') ? 'hit' : 'stand';
    const thinking = String(parsed.thinking || parsed.reason || parsed.reasoning || 'No reasoning provided');

    return LLMResponseSchema.parse({
      thinking,
      action: normalizedAction,
    });
  } catch (parseErr) {
    console.warn('[Gemma] JSON parse failed, trying fallback extraction:', parseErr);

    // Last resort: look for hit/stand keywords in the raw text
    const lowerText = text.toLowerCase();
    const hasHit = lowerText.includes('"hit"') || lowerText.includes("'hit'");
    const action = hasHit ? 'hit' : 'stand';
    const thinkingMatch = text.match(/thinking['":\s]+([^"]+)/i);
    const thinking = thinkingMatch?.[1]?.trim() || 'Gemma response parsed via fallback';

    return { thinking, action };
  }
}

let _geminiAvailable: boolean | null = null;

export async function isGeminiAvailable(): Promise<boolean> {
  if (_geminiAvailable !== null) return _geminiAvailable;
  console.log('[Gemma] Checking API availability...');
  try {
    const res = await fetchWithTimeout('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with: ok' }] }],
        generationConfig: { maxOutputTokens: 4 },
      }),
    }, 8000);
    _geminiAvailable = res.ok;
    if (res.ok) {
      console.log('[Gemma] ✅ API connected — LLM thinking enabled (gemma-3-27b-it)');
    } else {
      const body = await res.text().catch(() => '');
      console.warn(`[Gemma] ❌ API returned ${res.status} — falling back to rule-based`, body);
    }
    return _geminiAvailable;
  } catch (err) {
    _geminiAvailable = false;
    console.warn('[Gemma] ❌ API unreachable — falling back to rule-based', err);
    return false;
  }
}

export function resetGeminiAvailability() {
  _geminiAvailable = null;
}
