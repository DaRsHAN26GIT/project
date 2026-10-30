import { NextResponse } from "next/server";
import { scheduleRequest } from "@/lib/evaluation.mjs";
import { readJsonRequest } from "@/lib/read-request";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readJsonRequest(request);
    const started = performance.now();
    const result = scheduleRequest(body);
    return NextResponse.json(
      {
        ...result,
        computeMs: Math.round((performance.now() - started) * 100) / 100,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "Send valid JSON."
            : error instanceof Error
              ? error.message
              : "Invalid classroom request.",
      },
      { status: (error as { status?: number }).status === 413 ? 413 : 400 },
    );
  }
}
