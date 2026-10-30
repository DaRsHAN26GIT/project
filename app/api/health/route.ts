import { NextResponse } from "next/server";
import { auditSchedule, referenceScenario } from "@/lib/evaluation.mjs";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = !!(url && key);
  const provider =
    process.env.AI_PROVIDER === "huggingface" ? "huggingface" : "openai";
  const aiConfigured =
    provider === "huggingface"
      ? !!(process.env.HF_TOKEN && process.env.HF_MODEL)
      : !!process.env.OPENAI_API_KEY;
  let authStatus = configured ? "not_checked" : "not_configured",
    databaseStatus = configured ? "not_checked" : "not_configured";
  const authorization = request.headers.get("authorization");
  if (configured && authorization?.startsWith("Bearer ")) {
    try {
      const auth = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key!, Authorization: authorization },
        signal: AbortSignal.timeout(8000),
      });
      if (auth.ok) {
        authStatus = "verified";
        const database = await fetch(
          `${url}/rest/v1/records?select=id&limit=1`,
          {
            headers: { apikey: key!, Authorization: authorization },
            signal: AbortSignal.timeout(8000),
          },
        );
        databaseStatus = database.ok
          ? "authenticated_read_verified"
          : "read_failed";
      } else authStatus = "session_not_verified";
    } catch {
      if (authStatus === "verified") databaseStatus = "service_unreachable";
      else {
        authStatus = "service_unreachable";
        databaseStatus = "not_checked";
      }
    }
  }
  let schedulerStatus = "failed";
  let passedChecks = 0;
  try {
    const audit = auditSchedule(referenceScenario());
    schedulerStatus = audit.valid ? "passed" : "failed";
    passedChecks = audit.checks.filter((c) => c.passed).length;
  } catch {
    schedulerStatus = "failed";
  }
  return NextResponse.json(
    {
      status: schedulerStatus === "passed" ? "ok" : "degraded",
      server: "responding",
      checkedAt: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      scheduler: {
        status: schedulerStatus,
        passedChecks,
        scope: "Reference scenario self-check, not the full test suite",
      },
      authentication: { configured, status: authStatus },
      database: {
        configured,
        status: databaseStatus,
        scope:
          "Read-only probe; does not prove cross-account isolation or writes",
      },
      ai: {
        provider,
        configured: aiConfigured && configured,
        status:
          aiConfigured && configured
            ? "configured_not_live_verified"
            : "not_configured",
        scope: "No paid model call is made by this endpoint",
      },
    },
    {
      status: schedulerStatus === "passed" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
