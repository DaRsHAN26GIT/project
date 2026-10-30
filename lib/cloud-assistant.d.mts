import type { ClassroomInput, Plan } from "./engine.mjs";
import type { Worksheet } from "./assistant.mjs";
export type AssistantRequest = {
  message: string;
  input: ClassroomInput;
  history?: { role: "user" | "assistant"; content: string }[];
  progress?: { grade: number; score: number }[];
  language?: string;
};
export function validateAssistantRequest(body: unknown): AssistantRequest;
export function cloudAssistant(options: {
  provider?: string;
  apiKey: string;
  model: string;
  body: unknown;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{
  message: string;
  source: string;
  tools: string[];
  plan?: Plan;
  worksheet?: Worksheet;
}>;
