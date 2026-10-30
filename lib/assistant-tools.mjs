import { activities, generate, replan, explain } from "./engine.mjs";
import { worksheet } from "./assistant.mjs";
const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const grade = { type: "integer", minimum: 1, maximum: 12 };
export const assistantTools = [
  [
    "generate_worksheet",
    "Create a printable local worksheet with a verified answer key.",
    {
      grade,
      subject: { type: "string", enum: ["Mathematics", "Reading"] },
      difficulty: {
        type: "string",
        enum: ["supported", "standard", "stretch"],
      },
      topic: {
        type: "string",
        enum: ["multiplication", "addition", "subtraction"],
      },
    },
  ],
  ["get_classroom_details", "Read the current classroom configuration.", {}],
  [
    "generate_timetable",
    "Calculate a timetable proposal with the requested total time and priority grade.",
    {
      minutes: { type: "integer", minimum: 15, maximum: 480 },
      priorityGrade: {anyOf:[grade,{type:"null"}]},
    },
  ],
  [
    "replan_timetable",
    "Recalculate the current day after losing time.",
    {
      lostMinutes: { type: "integer", minimum: 0, maximum: 465 },
      priorityGrade: {anyOf:[grade,{type:"null"}]},
    },
  ],
  [
    "generate_learning_activity",
    "Return a primary activity, follow-up, easier alternative, and teacher checkpoint.",
    { grade },
  ],
  [
    "get_learning_progress",
    "Read the supplied aggregate assessment history; missing data means unknown.",
    {},
  ],
  [
    "explain_schedule_changes",
    "Compare the current schedule to the latest calculated proposal.",
    {},
  ],
].map(([name, description, properties]) => ({
  type: "function",
  name,
  description,
  parameters: object(properties),
  strict: true,
}));
export function runAssistantTool(
  name,
  args,
  input,
  progress = [],
  proposal = null,
) {
  switch (name) {
    case "generate_worksheet": {
      if (!input.grades.some((g) => g.id === args.grade))
        throw Error("Grade not in classroom.");
      const sheet = worksheet(args);
      return { data: sheet, worksheet: sheet };
    }
    case "get_classroom_details":
      return { data: input };
    case "generate_timetable": {
      if (args.priorityGrade!==null && !input.grades.some((g) => g.id === args.priorityGrade))
        throw Error("Grade not in classroom.");
      const next = {
        ...input,
        minutes: args.minutes,
        breakStart: Math.min(
          input.breakStart,
          Math.max(0, args.minutes - input.breakDuration),
        ),
        grades: input.grades.map((g) => ({
          ...g,
          priority: g.id === args.priorityGrade ? 5 : g.priority,
        })),
      };
      const plan = generate(next);
      return { data: plan, plan };
    }
    case "replan_timetable": {
      if (args.priorityGrade!==null && !input.grades.some((g) => g.id === args.priorityGrade))
        throw Error("Grade not in classroom.");
      const plan = replan(input, args.lostMinutes, args.priorityGrade);
      return { data: plan, plan };
    }
    case "generate_learning_activity": {
      const g = input.grades.find((g) => g.id === args.grade);
      if (!g) throw Error("Grade not in classroom.");
      return { data: activities(g) };
    }
    case "get_learning_progress":
      return { data: progress };
    case "explain_schedule_changes":
      return {
        data: proposal
          ? explain(generate(input), proposal)
          : ["No revised schedule has been proposed."],
      };
    default:
      throw Error("Unknown classroom tool.");
  }
}
