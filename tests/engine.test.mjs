import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultInput,
  generate,
  replan,
  command,
  validate,
} from "../lib/engine.mjs";
function constraints(plan) {
  let end = 0;
  const sums = new Map(plan.input.grades.map((g) => [g.id, 0]));
  for (const b of plan.blocks) {
    assert.equal(b.start, end);
    assert.ok(b.end > b.start && b.end <= plan.input.minutes);
    if (b.teacher !== null) {
      assert.ok(sums.has(b.teacher));
      assert.equal(b.break, false);
      sums.set(b.teacher, sums.get(b.teacher) + b.end - b.start);
    }
    if (
      plan.input.breakDuration &&
      b.start < plan.input.breakStart + plan.input.breakDuration &&
      b.end > plan.input.breakStart
    )
      assert.equal(b.break, true);
    end = b.end;
  }
  assert.equal(end, plan.input.minutes);
  for (const g of plan.input.grades) {
    const a = plan.attention.find((a) => a.grade === g.id);
    assert.equal(a.minutes, sums.get(g.id));
    assert.equal(
      a.minutes + (plan.unmet.find((u) => u.grade === g.id)?.minutes ?? 0),
      g.duration,
    );
    assert.ok(a.minutes <= g.duration);
  }
  assert.equal(plan.activities.length, plan.input.grades.length);
}
test("one teacher, no gaps, no overlapping blocks, breaks respected", () => {
  const p = generate(defaultInput);
  constraints(p);
  assert.equal(p.unmet.length, 0);
  assert.equal(
    p.attention.reduce((n, a) => n + a.minutes, 0),
    140,
  );
});
test("input changes change output and impossible requests remain visible", () => {
  const input = structuredClone(defaultInput);
  input.minutes = 60;
  input.breakStart = 30;
  const p = generate(input);
  constraints(p);
  assert.ok(p.unmet.length);
  assert.equal(
    p.attention.reduce((n, a) => n + a.minutes, 0),
    50,
  );
});
test("replanning really reduces time and prioritizes support", () => {
  const before = generate(defaultInput),
    p = replan(defaultInput, 70, 3);
  constraints(p);
  assert.equal(p.input.minutes, 110);
  assert.ok(p.unmet.length);
  assert.equal(p.input.grades.find((g) => g.id === 3).priority, 5);
  assert.notDeepEqual(p.blocks, before.blocks);
  assert.deepEqual(defaultInput.minutes, 180);
});
test("continuity includes four meaningful activities per group", () => {
  for (const a of generate(defaultInput).activities)
    for (const key of ["primary", "followUp", "easier", "checkpoint"])
      assert.ok(a[key].length > 20);
});
test("invalid inputs fail without a partial plan", () => {
  for (const input of [
    { ...defaultInput, minutes: 0 },
    { ...defaultInput, breakStart: 175 },
    {
      ...defaultInput,
      grades: [defaultInput.grades[0], defaultInput.grades[0]],
    },
    { ...defaultInput, grades: [{ ...defaultInput.grades[0], priority: 99 }] },
  ])
    assert.throws(() => validate(input));
  assert.throws(() => replan(defaultInput, 180, 3));
});
test("offline commands calculate proposals and do not mutate original", () => {
  const result = command(
    "Class 3 is struggling. Reduce time to 2 hours.",
    defaultInput,
  );
  assert.equal(result.plan.input.minutes, 120);
  assert.equal(result.plan.input.grades[1].priority, 5);
  assert.equal(defaultInput.minutes, 180);
  assert.ok(
    command("Show Class 2 activities", defaultInput).message.includes(
      "partner",
    ),
  );
  assert.ok(!command("hello", defaultInput).plan);
});
test("many feasible and infeasible schedules satisfy the same invariants", () => {
  for (let minutes = 15; minutes <= 480; minutes += 7) {
    const input = structuredClone(defaultInput);
    input.minutes = minutes;
    input.breakStart = Math.min(90, minutes - 10);
    constraints(generate(input));
  }
});

import { syncDecision } from "../lib/sync.mjs";
test("sync accepts multiple offline edits, detects stale updates and deleted remotes", () => {
  assert.deepEqual(syncDecision({ revision: 5, remoteRevision: 0 }, null), {
    action: "write",
    expected: 0,
  });
  assert.deepEqual(syncDecision({ remoteRevision: 2 }, { revision: 2 }), {
    action: "write",
    expected: 2,
  });
  assert.equal(
    syncDecision({ remoteRevision: 2 }, { revision: 3 }).action,
    "conflict",
  );
  assert.equal(syncDecision({ remoteRevision: 2 }, null).action, "conflict");
});

import { runAssistantTool, assistantTools } from "../lib/assistant-tools.mjs";
test("AI tools execute the real engine and reject unknown actions", () => {
  assert.equal(assistantTools.length, 6);
  const result = runAssistantTool(
    "replan_timetable",
    { lostMinutes: 30, priorityGrade: 3 },
    defaultInput,
  );
  assert.equal(result.plan.input.minutes, 150);
  constraints(result.plan);
  assert.ok(
    runAssistantTool("generate_learning_activity", { grade: 2 }, defaultInput)
      .data.primary,
  );
  assert.throws(() => runAssistantTool("delete_records", {}, defaultInput));
  assert.throws(() =>
    runAssistantTool(
      "generate_timetable",
      { minutes: 120, priorityGrade: 99 },
      defaultInput,
    ),
  );
});

test("support levels and group sizes influence attention under scarcity",()=>{const input={minutes:30,breakStart:0,breakDuration:0,grades:[{id:2,students:5,subject:"Reading",duration:60,priority:2,level:"Independent"},{id:3,students:20,subject:"Mathematics",duration:60,priority:2,level:"Needs support"}]};const p=generate(input);constraints(p);assert.ok(p.attention[1].minutes>p.attention[0].minutes);});
