import type { Worksheet } from "./assistant.mjs";
import type { ClassroomInput, Plan } from "./engine.mjs";
export const assistantTools: unknown[];
export function runAssistantTool(
  name: string,
  args: Record<string, number | string | null>,
  input: ClassroomInput,
  progress?: unknown[],
  proposal?: Plan | null,
): { data: unknown; plan?: Plan; worksheet?: Worksheet };
