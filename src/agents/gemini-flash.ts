import { z } from 'zod';

/**
 * Multi-turn Gemma API wrapper for the agentic tool-calling loop.
 *
 * Supports accumulating conversation history so the model can:
 *   1. Call a tool  → receive the result  → call another tool  → ...
 *   2. Finally return a {thinking, action} decision.
 *
 * This mirrors how external browser agents converse with an LLM
 * while using WebMCP tools.
 */

// ─── Response schemas ───

const ToolCallSchema = z.object({
  tool_call: z.string(),
});

const ActionSchema = z.object({
  thinking: z.string(),
  action: z.enum(['hit', 'stand']),
});

export type AgentResponse =
  | { type: 'tool_call'; toolName: string }
  | { type: 'action'; thinking: string; action: 'hit' | 'stand' };

// ─── Message types for multi-turn ───

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

// Fetch with timeout
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Send a multi-turn conversation to Gemma and parse the response
 * as either a tool_call or a final action.
 */
export async function callGeminiMultiTurn(
  messages: GeminiContent[],
): Promise<AgentResponse> {
  console.log('[Gemma] Calling API (multi-turn, %d messages)...', messages.length);

  const response = await fetchWithTimeout('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages,
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

  return parseAgentResponse(text);
}

/**
 * Parse Gemma's text output into either a tool_call or a final action.
 */
function parseAgentResponse(text: string): AgentResponse {
  // Extract JSON — Gemma may wrap in markdown backticks
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemma response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Check if it's a tool_call
    if (parsed.tool_call) {
      const validated = ToolCallSchema.parse(parsed);
      return { type: 'tool_call', toolName: validated.tool_call };
    }

    // Otherwise it should be a final action
    const action = String(parsed.action || '').toLowerCase().trim();
    const normalizedAction = action.startsWith('hit') ? 'hit' : 'stand';
    const thinking = String(
      parsed.thinking || parsed.reason || parsed.reasoning || 'No reasoning provided',
    );

    ActionSchema.parse({ thinking, action: normalizedAction });
    return { type: 'action', thinking, action: normalizedAction };
  } catch (parseErr) {
    console.warn('[Gemma] JSON parse failed, trying fallback extraction:', parseErr);

    // Last resort: look for tool_call or hit/stand keywords
    const lower = text.toLowerCase();

    // Check for tool call keywords
    const toolMatch = text.match(/tool_call['":\s]+['"]([\w]+)['"]/i);
    if (toolMatch) {
      return { type: 'tool_call', toolName: toolMatch[1] };
    }

    // Fall back to action detection
    const hasHit = lower.includes('"hit"') || lower.includes("'hit'");
    const actionType = hasHit ? 'hit' as const : 'stand' as const;
    const thinkingMatch = text.match(/thinking['":\s]+([^"]+)/i);
    const thinking = thinkingMatch?.[1]?.trim() || 'Gemma response parsed via fallback';

    return { type: 'action', thinking, action: actionType };
  }
}

// ─── Helper to build conversation messages ───

export function makeUserMessage(text: string): GeminiContent {
  return { role: 'user', parts: [{ text }] };
}

export function makeModelMessage(text: string): GeminiContent {
  return { role: 'model', parts: [{ text }] };
}

// ─── Availability check (unchanged) ───

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
