import test from "node:test";
import assert from "node:assert/strict";
import { generate, defaultInput, replan } from "../lib/engine.mjs";
import {
  auditSchedule,
  scheduleRequest,
  evidenceReport,
  judgeBrief,
  criteria,
} from "../lib/evaluation.mjs";
test("evaluation independently audits actual teaching, breaks, coverage and unmet minutes", () => {
  const plan = generate(defaultInput);
  const audit = auditSchedule(plan);
  assert.equal(audit.valid, true);
  assert.equal(audit.teacherConflictMinutes, 0);
  assert.equal(audit.availableMinutes, 170);
  assert.equal(audit.allocatedTeachingMinutes, 140);
  assert.equal(audit.independentRequiredMinutes, 370);
  assert.equal(audit.independentCoveredMinutes, 370);
  assert.equal(audit.unmetMinutes, 0);
  const revised = auditSchedule(replan(defaultInput, 45, 3));
  assert.equal(revised.valid, true);
  assert.equal(revised.availableMinutes, 125);
  assert.equal(revised.unmetMinutes, 15);
});
test("audit rejects overlapping teacher/group blocks instead of assuming engine success", () => {
  const plan = generate(defaultInput);
  plan.blocks.push({ ...plan.blocks[0] });
  const audit = auditSchedule(plan);
  assert.equal(audit.valid, false);
  assert.ok(audit.teacherConflictMinutes > 0);
  assert.ok(audit.groupOverlapMinutes > 0);
  assert.ok(audit.unplannedGradeMinutes > 0);
});
test("missing work, breaks, unknown grades and invalid horizons are visible failures", () => {
  const baseline = generate(defaultInput);
  const noWork = structuredClone(baseline);
  noWork.blocks = [];
  const empty = auditSchedule(noWork);
  assert.equal(empty.valid, false);
  assert.equal(empty.independentCoverage, 0);
  assert.ok(empty.breakViolationMinutes > 0);
  const noTemplate = structuredClone(baseline);
  noTemplate.activities[0].primary = "";
  assert.ok(auditSchedule(noTemplate).independentCoverage < 100);
  const invalid = structuredClone(baseline);
  invalid.blocks[0].end = 999;
  assert.equal(auditSchedule(invalid).invalidBlocks, 1);
  const unknown = structuredClone(baseline);
  unknown.blocks[0].teacher = 99;
  assert.equal(
    auditSchedule(unknown).checks.find((c) => c.id === "grades").passed,
    false,
  );
});
test("server request computation matches local results and validates inputs", () => {
  const result = scheduleRequest({
    action: "replan",
    input: defaultInput,
    lostMinutes: 60,
    priorityGrade: 3,
  });
  assert.deepEqual(result.plan, replan(defaultInput, 60, 3));
  assert.equal(result.audit.valid, true);
  assert.deepEqual(
    scheduleRequest({ input: defaultInput }).plan,
    generate(defaultInput),
  );
  assert.throws(() =>
    scheduleRequest({ action: "delete", input: defaultInput }),
  );
  assert.throws(() =>
    scheduleRequest({
      action: "replan",
      input: defaultInput,
      lostMinutes: 30,
      priorityGrade: 99,
    }),
  );
  assert.throws(() =>
    scheduleRequest({ input: { ...defaultInput, minutes: 999999 } }),
  );
});
test("judge report includes exact reproducible plans and honest evidence boundaries", () => {
  const before = generate(defaultInput),
    after = replan(defaultInput, 45, 3);
  const report = evidenceReport(before, after, {
    online: false,
    notes: "Judge changed the interruption to 45 minutes.",
  });
  assert.equal(report.criteria.length, 6);
  assert.deepEqual(
    report.criteria.map((c) => c.title),
    ["Innovation", "Impact", "Execution", "UI/UX", "Demo", "Feasibility"],
  );
  assert.equal(report.after.audit.unmetMinutes, 15);
  assert.equal(report.observations.fieldTesting, "Not conducted");
  assert.equal(report.observations.browserReportsOnline, false);
  assert.equal(report.observations.liveAI, "Not verified by this report");
  assert.ok(judgeBrief(report).includes("180 → 135"));
  assert.ok(judgeBrief(report).includes("not measured learning outcomes"));
  assert.throws(() =>
    evidenceReport(before, after, { notes: "x".repeat(1501) }),
  );
  assert.equal(criteria.length, 6);
});
