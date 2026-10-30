export type Grade = {
  id: number;
  students: number;
  subject: string;
  duration: number;
  priority: number;
  level: string;
};
export type ClassroomInput = {
  minutes: number;
  breakStart: number;
  breakDuration: number;
  grades: Grade[];
};
export type Activity = {
  primary: string;
  followUp: string;
  easier: string;
  checkpoint: string;
  subject: string;
  grade: number;
};
export type Plan = {
  input: ClassroomInput;
  blocks: {
    start: number;
    end: number;
    teacher: number | null;
    break: boolean;
  }[];
  unmet: { grade: number; minutes: number }[];
  attention: { grade: number; minutes: number }[];
  activities: Activity[];
};
export const defaultInput: ClassroomInput;
export function validate(input: ClassroomInput): ClassroomInput;
export function generate(input: ClassroomInput): Plan;
export function activities(grade: Grade): Activity;
export function replan(
  input: ClassroomInput,
  lost: number,
  priorityGrade: number,
): Plan;
export function explain(before: Plan, after: Plan): string[];
export function command(
  text: string,
  input: ClassroomInput,
): { message: string; plan?: Plan };
