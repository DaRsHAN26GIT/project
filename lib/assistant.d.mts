import type { ClassroomInput, Plan } from "./engine.mjs";
export type Worksheet = {
  title: string;
  grade: number;
  subject: string;
  difficulty: string;
  passage?: string;
  instructions: string;
  questions: { prompt: string; answer: string }[];
  checkpoint: string;
  source: string;
};
export function worksheet(options: {
  grade: number;
  subject?: string;
  difficulty?: string;
  topic?: string;
}): Worksheet;
export function localReply(
  text: string,
  input: ClassroomInput,
  options?: { grade?: number },
): { message: string; plan?: Plan; worksheet?: Worksheet; source: "local" };
export function worksheetText(sheet: Worksheet, answers?: boolean): string;
