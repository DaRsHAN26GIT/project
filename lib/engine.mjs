export const defaultInput = {
  minutes: 180,
  breakStart: 90,
  breakDuration: 10,
  grades: [
    {
      id: 2,
      students: 10,
      subject: "Reading",
      duration: 45,
      priority: 2,
      level: "Developing",
    },
    {
      id: 3,
      students: 12,
      subject: "Mathematics",
      duration: 55,
      priority: 3,
      level: "Needs support",
    },
    {
      id: 4,
      students: 8,
      subject: "Science",
      duration: 40,
      priority: 1,
      level: "Independent",
    },
  ],
};
export function validate(input) {
  if (
    !Number.isInteger(input.minutes) ||
    input.minutes < 15 ||
    input.minutes > 480
  )
    throw Error("Available time must be 15–480 whole minutes.");
  if (
    !Array.isArray(input.grades) ||
    !input.grades.length ||
    input.grades.length > 8
  )
    throw Error("Choose 1–8 grades.");
  if (new Set(input.grades.map((g) => g.id)).size !== input.grades.length)
    throw Error("Grade identifiers must be unique.");
  for (const g of input.grades)
    if (
      !Number.isInteger(g.id) ||
      g.id < 1 ||
      g.id > 12 ||
      !Number.isInteger(g.students) ||
      g.students < 1 ||
      g.students > 100 ||
      !Number.isInteger(g.duration) ||
      g.duration < 5 ||
      g.duration > 480 ||
      !Number.isFinite(g.priority) ||
      g.priority < 1 ||
      g.priority > 5 ||
      typeof g.subject !== "string" ||
      !g.subject.trim() ||
      g.subject.length > 80 ||
      typeof g.level !== "string" ||
      g.level.length > 80
    )
      throw Error(
        "Check grade, students, subject, duration, and priority (1–5).",
      );
  if (
    !Number.isInteger(input.breakStart) ||
    !Number.isInteger(input.breakDuration) ||
    input.breakStart < 0 ||
    input.breakDuration < 0 ||
    input.breakStart + input.breakDuration > input.minutes
  )
    throw Error("Break must fit within available time.");
  return input;
}
export function activities(g) {
  return {
    primary:
      g.subject === "Mathematics"
        ? "Build equal groups using seeds; draw and label four examples."
        : g.subject === "Reading"
          ? "Read a short story with a partner and circle five new words."
          : "Observe three classroom objects; draw and compare their properties.",
    followUp: "Explain your method to a partner and write one question.",
    easier: "Use pictures or objects; complete one example with a peer.",
    checkpoint: "Teacher checks one example and asks the group to explain why.",
    subject: g.subject,
    grade: g.id,
  };
}
function weight(g) {
  const support = /needs support|struggling/i.test(g.level)
    ? 1.3
    : /developing/i.test(g.level)
      ? 1.1
      : 1;
  return g.priority * support * Math.sqrt(g.students / 10);
}
export function generate(input) {
  validate(input);
  const blocks = [],
    remaining = new Map(input.grades.map((g) => [g.id, g.duration])),
    allocated = new Map(input.grades.map((g) => [g.id, 0]));
  let t = 0;
  // ponytail: greedy 10-minute allocation balances attention; use an optimizer only if measured classroom constraints require it.
  while (t < input.minutes) {
    if (
      input.breakDuration &&
      t >= input.breakStart &&
      t < input.breakStart + input.breakDuration
    ) {
      blocks.push({
        start: t,
        end: input.breakStart + input.breakDuration,
        teacher: null,
        break: true,
      });
      t = input.breakStart + input.breakDuration;
      continue;
    }
    const boundary =
      input.breakDuration && t < input.breakStart
        ? input.breakStart
        : input.minutes;
    const candidates = input.grades
      .filter((g) => remaining.get(g.id) > 0)
      .sort(
        (a, b) =>
          weight(b) / (1 + allocated.get(b.id) / 10) -
            weight(a) / (1 + allocated.get(a.id) / 10) || a.id - b.id,
      );
    const g = candidates[0];
    const end = Math.min(
      t + (g ? Math.min(10, remaining.get(g.id)) : 10),
      boundary,
      input.minutes,
    );
    blocks.push({ start: t, end, teacher: g?.id ?? null, break: false });
    if (g) {
      remaining.set(g.id, remaining.get(g.id) - (end - t));
      allocated.set(g.id, allocated.get(g.id) + (end - t));
    }
    t = end;
  }
  return {
    input: structuredClone(input),
    blocks,
    unmet: input.grades
      .map((g) => ({ grade: g.id, minutes: remaining.get(g.id) }))
      .filter((g) => g.minutes > 0),
    attention: input.grades.map((g) => ({
      grade: g.id,
      minutes: allocated.get(g.id),
    })),
    activities: input.grades.map(activities),
  };
}
export function replan(input, lost, priorityGrade) {
  if (!Number.isInteger(lost) || lost < 0 || lost > input.minutes - 15)
    throw Error("Lost time must leave at least 15 minutes.");
  const next = structuredClone(input);
  next.minutes -= lost;
  next.breakStart = Math.min(
    next.breakStart,
    Math.max(0, next.minutes - next.breakDuration),
  );
  next.grades = next.grades.map((g) => ({
    ...g,
    priority: g.id === priorityGrade ? 5 : g.priority,
  }));
  return generate(next);
}
export function explain(before, after) {
  return after.attention
    .map((a) => {
      const old =
        before.attention.find((b) => b.grade === a.grade)?.minutes ?? 0;
      return `Class ${a.grade}: ${a.minutes} teacher-led minutes (${a.minutes - old >= 0 ? "+" : ""}${a.minutes - old}). Independent activities fill remaining non-break time.`;
    })
    .concat(
      after.unmet.map(
        (g) =>
          `Class ${g.grade}: ${g.minutes} requested minutes postponed; teacher approval required.`,
      ),
    );
}
export function command(text, input) {
  const next = structuredClone(input);
  const m = text.toLowerCase().match(/(\d+)\s*(hours?|minutes?)/);
  if (m) {
    const duration = Number(m[1]) * (m[2].startsWith("hour") ? 60 : 1);
    next.minutes = /\b(lost|lose|losing|interruption)\b/i.test(text)
      ? input.minutes - duration
      : duration;
  }
  next.breakStart = Math.min(
    next.breakStart,
    Math.max(0, next.minutes - next.breakDuration),
  );
  const grade = text.match(/class\s*(\d+)/i);
  if (/prioriti|struggl|support/i.test(text) && grade)
    next.grades = next.grades.map((g) => ({
      ...g,
      priority: g.id === Number(grade[1]) ? 5 : g.priority,
    }));
  if (
    !/generat|timetable|hours?|minutes?|prioriti|struggl|support|activit/i.test(
      text,
    )
  )
    return {
      message:
        "Offline commands: generate a timetable, reduce time to 120 minutes, prioritize Class 3, or show Class 2 activities.",
    };
  if (/activit/i.test(text)) {
    const g = next.grades.find((g) => g.id === Number(grade?.[1] ?? 2));
    return {
      message: g
        ? Object.values(activities(g)).slice(0, 4).join("\n")
        : "Grade not found.",
    };
  }
  return {
    plan: generate(next),
    message:
      "Calculated locally using a deterministic scheduling heuristic. Review this proposal before approving.",
  };
}
