import { NextResponse } from "next/server";
import {
  cloudAssistant,
  validateAssistantRequest,
} from "@/lib/cloud-assistant.mjs";
export const runtime = "nodejs";
// ponytail: per-instance demo throttle; use a durable account quota before a public rollout.
const requests = new Map<string, { count: number; expires: number }>();
function configuration() {
  const provider =
    process.env.AI_PROVIDER === "huggingface" ? "huggingface" : "openai";
  const apiKey =
    provider === "huggingface"
      ? process.env.HF_TOKEN
      : process.env.OPENAI_API_KEY;
  const model =
    provider === "huggingface"
      ? process.env.HF_MODEL
      : process.env.OPENAI_MODEL || "gpt-4.1-mini";
  return {
    provider,
    apiKey,
    model,
    authConfigured: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}
export function GET() {
  const c = configuration();
  return NextResponse.json(
    {
      provider: c.provider,
      configured: !!(c.apiKey && c.model && c.authConfigured),
      authConfigured: c.authConfigured,
      modelConfigured: !!(c.apiKey && c.model),
      requiresSignIn: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  const config = configuration();
  if (!config.apiKey || !config.model || !config.authConfigured)
    return NextResponse.json(
      {
        error:
          "Cloud AI is not configured. Local commands and worksheet templates remain available.",
        code: "not_configured",
      },
      { status: 503 },
    );
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return NextResponse.json(
      { error: "Sign in to use cloud AI.", code: "sign_in_required" },
      { status: 401 },
    );
  try {
    const auth = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: authorization,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!auth.ok)
      return NextResponse.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401 },
      );
    const user = await auth.json();
    if (!user.id)
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const now = Date.now();
    for (const [id, entry] of requests)
      if (entry.expires < now) requests.delete(id);
    const quota = requests.get(user.id) ?? { count: 0, expires: now + 60000 };
    if (quota.count >= 6)
      return NextResponse.json(
        { error: "Please wait a minute before asking again." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    quota.count++;
    requests.set(user.id, quota);
    const reader = request.body?.getReader();
    if (!reader)
      return NextResponse.json({ error: "Empty request." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 48000) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Request too large." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      validateAssistantRequest(body);
    } catch {
      return NextResponse.json(
        { error: "Check your message and classroom inputs." },
        { status: 400 },
      );
    }
    const result = await cloudAssistant({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      body,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "The assistant is unavailable. Try a local command.",
      },
      { status: 502 },
    );
  }
}
