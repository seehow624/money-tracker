import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  TOOLS,
  executeTool,
  buildSystemPrompt,
  type RecordedTransaction,
} from '@/lib/ai-tools';
import { getAIRouting, type AIRoute } from '@/lib/settings';
import { checkAuthOrSameOrigin, resolveUserId } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_ITERATIONS = 8;

type RunOk = {
  ok: true;
  message: string;
  recorded: RecordedTransaction[];
  used: { profile: string; model: string };
  fellBack?: { from: { profile: string; model: string }; reason: string };
};
type RunErr = { ok: false; error: string };

export async function POST(req: Request) {
  const authErr = checkAuthOrSameOrigin(req);
  if (authErr) return authErr;

  // Resolve userId: prefer session cookie (browser UI), fall back to admin
  // for Bearer-token callers (Luna-style scripts).
  const userId = await resolveUserId(req);
  if (userId === 'no_admin') {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }
  if (userId === null) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = (body.text ?? '').trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ ok: false, error: 'text too long' }, { status: 400 });
  }

  const routing = getAIRouting();
  if (!routing.primary || !routing.primary.model) {
    return NextResponse.json(
      { ok: false, error: 'No primary AI model configured. Set one at /more/ai.' },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(userId);

  // Treat fallback as "configured" only when both profile and model are set.
  const fallback =
    routing.fallback && routing.fallback.model ? routing.fallback : null;

  // Try primary; on any error, retry once with fallback if configured.
  const primaryResult = await runConversation(userId, routing.primary, text, systemPrompt);
  if (primaryResult.ok) {
    return NextResponse.json(primaryResult);
  }

  if (!fallback) {
    return NextResponse.json({ ok: false, error: primaryResult.error }, { status: 502 });
  }

  const fallbackResult = await runConversation(userId, fallback, text, systemPrompt);
  if (fallbackResult.ok) {
    return NextResponse.json({
      ...fallbackResult,
      fellBack: {
        from: { profile: routing.primary.profile.name, model: routing.primary.model },
        reason: primaryResult.error,
      },
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: `Primary failed (${primaryResult.error}); fallback also failed (${fallbackResult.error}).`,
    },
    { status: 502 },
  );
}

async function runConversation(
  userId: number,
  route: AIRoute,
  userText: string,
  systemPrompt: string,
): Promise<RunOk | RunErr> {
  const client = new OpenAI({
    baseURL: route.profile.baseUrl,
    apiKey: route.profile.apiKey || 'unused',
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userText },
  ];

  const recorded: RecordedTransaction[] = [];
  let finalText = '';

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.chat.completions.create({
        model: route.model,
        messages,
        tools: TOOLS,
        // OpenAI/Ollama: temperature default 1.0; lower it for deterministic
        // tool selection on short bookkeeping inputs.
        temperature: 0.2,
      });

      const choice = response.choices[0];
      if (!choice) {
        finalText = '(no response from model)';
        break;
      }
      const msg = choice.message;
      messages.push(msg);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        finalText = (msg.content ?? '').trim();
        break;
      }

      for (const tc of toolCalls) {
        if (tc.type !== 'function') continue;
        let args: Record<string, unknown> = {};
        try {
          args = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: 'invalid_json_arguments' }),
          });
          continue;
        }

        try {
          const result = await executeTool(userId, tc.function.name, args);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result.toolResult,
          });
          if (result.recorded) recorded.push(result.recorded);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: 'tool_threw', message: errMsg }),
          });
        }
      }
    }
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      return { ok: false, error: `${route.profile.name}: API ${err.status ?? '?'} ${err.message}` };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `${route.profile.name}: ${msg}` };
  }

  return {
    ok: true,
    message: finalText || '(no response)',
    recorded,
    used: { profile: route.profile.name, model: route.model },
  };
}
