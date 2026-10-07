import { GoogleGenAI } from 'npm:@google/genai@2.27.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { modelCandidates } from '../_shared/models.ts';
import { MAX_SNACK_CHARS, MAX_SNACK_WORDS, parseSnackEstimate, wordCount } from '../_shared/words.ts';

const TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 25_000;
const MIN_ATTEMPT_MS = 3_000;

const SYSTEM_PROMPT = `You estimate the calories of one meal, snack, or drink from a short description.
Use a typical serving when the amount is missing. Round to the nearest 10 kcal.
If the text is not food or drink, set food to false and calories to 0.
Respond with JSON only: {"food": boolean, "calories": number}.`;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.slice('Bearer '.length)
  );
  if (userError || !userData.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

  const body: unknown = await req.json().catch(() => null);
  const description =
    typeof body === 'object' && body !== null && 'description' in body && typeof body.description === 'string'
      ? body.description.trim()
      : '';
  if (wordCount(description) === 0) return jsonResponse({ error: 'EMPTY' }, 400);
  if (wordCount(description) > MAX_SNACK_WORDS || description.length > MAX_SNACK_CHARS) {
    return jsonResponse({ error: 'TOO_LONG' }, 400);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'ESTIMATE_FAILED' }, 503);

  const models = modelCandidates(Deno.env.get('GEMINI_MODEL'), Deno.env.get('GEMINI_FALLBACK_MODELS'));
  const started = Date.now();
  for (const model of models) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: Math.min(TIMEOUT_MS, remaining) } });
    try {
      const response = await ai.models.generateContent({
        model,
        contents: description,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: {
              food: { type: 'boolean' },
              calories: { type: 'number' },
            },
            required: ['food', 'calories'],
          },
          thinkingConfig: { thinkingLevel: 'low' },
        },
      });
      const parsed = parseSnackEstimate(JSON.parse(response.text ?? ''));
      if (parsed.ok) return jsonResponse({ calories: parsed.calories });
      if (parsed.error === 'NOT_FOOD') return jsonResponse({ error: 'NOT_FOOD' }, 422);
    } catch {
      // The description is never logged. Try the next model.
    }
    console.warn(`snack estimate model ${model} failed, trying next`);
  }

  console.error('snack estimate failed');
  return jsonResponse({ error: 'ESTIMATE_FAILED' }, 503);
});
