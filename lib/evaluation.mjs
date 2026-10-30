import { defaultInput, generate, replan, validate } from "./engine.mjs";
export const criteria = [
  {
    id: "innovation",
    title: "Innovation",
    evidence:
      "A working attention-allocation and learning-continuity workflow, with deterministic replanning when time changes.",
    limit:
      "Workflow differentiation, not a claim of global novelty or mathematical optimality.",
  },
  {
    id: "impact",
    title: "Impact",
    evidence:
      "Visible teaching demand, unmet minutes, and planned independent coverage for the displayed scenario.",
    limit:
      "Calculated planning measures. No classroom learning gains, teacher acceptance, or field-trial results are claimed.",
  },
  {
    id: "execution",
    title: "Execution",
    evidence:
      "Local scheduling, a real scheduling route, independent constraint audits, optional authenticated integrations, and reproducible tests.",
    limit:
      "A successful scheduling request does not establish live AI or database readiness.",
  },
  {
    id: "uiux",
    title: "UI/UX",
    evidence:
      "Responsive navigation, keyboard-accessible shadcn/ui controls, readable plans, reduced-motion/2D fallback, and explicit teacher approval.",
    limit:
      "Automated browser checks are not a substitute for teacher usability research.",
  },
  {
    id: "demo",
    title: "Demo",
    evidence:
      "Change lost minutes and support priorities, inspect both schedules, and export the actual inputs and results.",
    limit:
      "This is a reproducible fictional scenario, not a recording of a field deployment.",
  },
  {
    id: "feasibility",
    title: "Feasibility",
    evidence:
      "Core scheduling runs locally; essential records use IndexedDB; optional cloud services have explicit configuration and authentication requirements.",
    limit:
      "Independent tasks require teacher review. Shared-device storage is not encrypted. Cloud pricing and availability depend on the configured services.",
  },
];
export function auditSchedule(plan) {
  validate(plan.input);
  const { input } = plan;
  if (!Array.isArray(plan.blocks) || !Array.isArray(plan.activities))
    throw Error("A plan must contain blocks and activity templates.");
  const ids = new Set(input.grades.map((g) => g.id));
  const invalidBlocks = plan.blocks.filter(
    (b) =>
      !b ||
      !Number.isInteger(b.start) ||
      !Number.isInteger(b.end) ||
      b.start < 0 ||
      b.end > input.minutes ||
      b.end <= b.start ||
      typeof b.break !== "boolean",
  );
  const validBlocks = plan.blocks.filter((b) => !invalidBlocks.includes(b));
  const unknownTeachers = validBlocks.filter(
    (b) => b.teacher !== null && !ids.has(b.teacher),
  ).length;
  const templates = new Set(
    plan.activities
      .filter(
        (a) =>
          a &&
          ["primary", "followUp", "easier", "checkpoint"].every(
            (k) => typeof a[k] === "string" && a[k].trim(),
          ),
      )
      .map((a) => a.grade),
  );
  let teacherConflictMinutes = 0,
    groupOverlapMinutes = 0,
    breakViolationMinutes = 0,
    unplannedGradeMinutes = 0,
    independentCoveredMinutes = 0,
    independentRequiredMinutes = 0,
    availableMinutes = 0;
  const attention = new Map(input.grades.map((g) => [g.id, 0]));
  for (let minute = 0; minute < input.minutes; minute++) {
    const blocks = validBlocks.filter(
      (b) => b.start <= minute && minute < b.end,
    );
    const isBreak =
      !!input.breakDuration &&
      minute >= input.breakStart &&
      minute < input.breakStart + input.breakDuration;
    if (blocks.filter((b) => b.teacher !== null).length > 1)
      teacherConflictMinutes++;
    if (isBreak) {
      if (blocks.length > 1) groupOverlapMinutes += input.grades.length;
      if (blocks.length !== 1 || !blocks[0].break || blocks[0].teacher !== null)
        breakViolationMinutes++;
      continue;
    }
    availableMinutes++;
    if (blocks.some((b) => b.break)) breakViolationMinutes++;
    for (const grade of input.grades) {
      if (blocks.length > 1) groupOverlapMinutes++;
      if (blocks.length !== 1 || blocks[0].break) {
        unplannedGradeMinutes++;
        independentRequiredMinutes++;
        continue;
      }
      if (blocks[0].teacher === grade.id)
        attention.set(grade.id, attention.get(grade.id) + 1);
      else {
        independentRequiredMinutes++;
        if (templates.has(grade.id)) independentCoveredMinutes++;
        else unplannedGradeMinutes++;
      }
    }
  }
  const assigned = input.grades.map((g) => ({
    grade: g.id,
    requested: g.duration,
    allocated: attention.get(g.id),
    unmet: Math.max(0, g.duration - attention.get(g.id)),
  }));
  const overallocatedMinutes = assigned.reduce(
    (n, g) => n + Math.max(0, g.allocated - g.requested),
    0,
  );
  const checks = [
    {
      id: "teacher",
      label: "One teacher at a time",
      passed: teacherConflictMinutes === 0,
      detail: `${teacherConflictMinutes} minutes of conflicting teacher assignments`,
    },
    {
      id: "groups",
      label: "No overlapping group activities",
      passed: groupOverlapMinutes === 0,
      detail: `${groupOverlapMinutes} grade-minutes affected by overlaps`,
    },
    {
      id: "horizon",
      label: "Inside the available time",
      passed: invalidBlocks.length === 0,
      detail: `${invalidBlocks.length} invalid or out-of-range blocks`,
    },
    {
      id: "breaks",
      label: "Classroom breaks respected",
      passed: breakViolationMinutes === 0,
      detail: `${breakViolationMinutes} break-rule violations in minutes`,
    },
    {
      id: "grades",
      label: "Teacher assigned to known grades",
      passed: unknownTeachers === 0,
      detail: `${unknownTeachers} assignments to unknown grades`,
    },
    {
      id: "coverage",
      label: "Every group has a planned activity",
      passed: unplannedGradeMinutes === 0,
      detail: `${unplannedGradeMinutes} unplanned grade-minutes`,
    },
    {
      id: "duration",
      label: "No unrequested teaching over-allocation",
      passed: overallocatedMinutes === 0,
      detail: `${overallocatedMinutes} extra teaching minutes beyond requests`,
    },
  ];
  return {
    valid: checks.every((c) => c.passed),
    checks,
    teacherConflictMinutes,
    groupOverlapMinutes,
    breakViolationMinutes,
    invalidBlocks: invalidBlocks.length,
    unplannedGradeMinutes,
    availableMinutes,
    independentRequiredMinutes,
    independentCoveredMinutes,
    independentCoverage: independentRequiredMinutes
      ? Math.round(
          (100 * independentCoveredMinutes) / independentRequiredMinutes,
        )
      : 100,
    requestedTeachingMinutes: assigned.reduce((n, g) => n + g.requested, 0),
    allocatedTeachingMinutes: assigned.reduce((n, g) => n + g.allocated, 0),
    unmetMinutes: assigned.reduce((n, g) => n + g.unmet, 0),
    attention: assigned,
  };
}
export function scheduleRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Error("Provide a classroom request.");
  validate(body.input);
  let plan;
  if (body.action === undefined || body.action === "generate")
    plan = generate(body.input);
  else if (body.action === "replan") {
    if (
      body.priorityGrade !== null &&
      !body.input.grades.some((g) => g.id === body.priorityGrade)
    )
      throw Error(
        "Choose a grade in the classroom, or null to preserve priorities.",
      );
    plan = replan(body.input, body.lostMinutes, body.priorityGrade);
  } else throw Error("Choose generate or replan.");
  return {
    plan,
    audit: auditSchedule(plan),
    source: "Server-side deterministic scheduler",
  };
}
export function evidenceReport(
  before,
  after,
  { notes = "", online = null, scenario = "Fictional classroom exercise" } = {},
) {
  if (typeof notes !== "string" || notes.length > 1500)
    throw Error("Evaluator notes must be at most 1500 characters.");
  return {
    project: "RuralClass AI",
    event: "RAISE · FOUNDRY GAMES 2026 · Level 2 final evaluation",
    generatedAt: new Date().toISOString(),
    scenario,
    evidenceType: "Calculated scenario; not field results",
    algorithm:
      "Priority-weighted fair-share greedy heuristic; no optimality guarantee",
    before: { plan: before, audit: auditSchedule(before) },
    after: after ? { plan: after, audit: auditSchedule(after) } : null,
    criteria,
    notes,
    observations: {
      browserReportsOnline: online,
      liveAI: "Not verified by this report",
      databaseAccess: "Not verified by this report",
      fieldTesting: "Not conducted",
      learningGains: "Not measured",
      teacherAcceptance: "Not measured",
    },
    references: {
      source: "https://github.com/DaRsHAN26GIT/project",
      tests: "https://github.com/DaRsHAN26GIT/project/actions",
      research: ["https://udiseplus.gov.in/", "https://asercentre.org/"],
    },
  };
}
export function judgeBrief(report) {
  const before = report.before.audit,
    after = report.after?.audit;
  return `RURALCLASS AI — JUDGE EVIDENCE BRIEF\n${report.event}\nGenerated: ${report.generatedAt}\n${report.scenario}\n\nWHAT WAS DEMONSTRATED\n${report.before.plan.input.grades.length} grades; ${report.before.plan.input.grades.reduce((n, g) => n + g.students, 0)} learners in the displayed scenario.\nAvailable time: ${report.before.plan.input.minutes} → ${report.after?.plan.input.minutes ?? "not replanned"} minutes.\nTeacher conflicts: ${before.teacherConflictMinutes} → ${after?.teacherConflictMinutes ?? "not replanned"} minutes.\nPlanned independent coverage: ${before.independentCoverage}% → ${after?.independentCoverage ?? "not replanned"}%.\nUnmet teaching requests: ${before.unmetMinutes} → ${after?.unmetMinutes ?? "not replanned"} minutes.\nThese are calculated schedule measures, not measured learning outcomes.\n\n${report.criteria.map((c, i) => `${i + 1}. ${c.title.toUpperCase()}\nEvidence: ${c.evidence}\nBoundary: ${c.limit}`).join("\n\n")}\n\nREPRODUCE\nUse the exported JSON inputs with the local scheduler or POST /api/schedule.\nRun npm test, npm run typecheck, npm run lint, npm run build, then browser checks against a running server.\nSource: ${report.references.source}\n\nEVALUATOR NOTES\n${report.notes || "None recorded."}\n\nFIELD VALIDATION\nNot conducted. Planned pilot measures: conflicts, activity coverage, planning time, teacher acceptance, and classroom feasibility.\n`;
}
export function referenceScenario() {
  return generate(defaultInput);
}
