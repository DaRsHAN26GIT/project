import test from "node:test";
import assert from "node:assert/strict";
import { defaultInput, generate } from "../lib/engine.mjs";
import { localReply, worksheet, worksheetText } from "../lib/assistant.mjs";
import {
  validateAssistantRequest,
  cloudAssistant,
} from "../lib/cloud-assistant.mjs";
import { runAssistantTool } from "../lib/assistant-tools.mjs";
test("lost time subtracts from the current classroom, not replacing its horizon", () => {
  const reply = localReply(
    "I lost 30 minutes today. Prioritize Class 3.",
    defaultInput,
  );
  assert.equal(reply.plan.input.minutes, 150);
  assert.equal(defaultInput.minutes, 180);
  assert.equal(reply.source, "local");
  assert.throws(() => localReply("I lost 200 minutes", defaultInput));
});
test("worksheets include correct answer keys, difficulty and printing formats", () => {
  for (const grade of [1, 3, 8, 12])
    for (const difficulty of ["supported", "standard", "stretch"])
      for (const topic of ["multiplication", "addition", "subtraction"]) {
        const sheet = worksheet({ grade, difficulty, topic });
        assert.equal(
          sheet.questions.length,
          difficulty === "supported" ? 4 : 6,
        );
        for (const q of sheet.questions) {
          const [a, op, b] = q.prompt.split(" ");
          const result = op === "×" ? +a * +b : op === "+" ? +a + +b : +a - +b;
          assert.equal(Number(q.answer), result);
        }
        assert.ok(!worksheetText(sheet).includes("Answer:"));
        assert.ok(worksheetText(sheet, true).includes("Answer:"));
      }
  const reading = worksheet({ grade: 3, subject: "Reading" });
  assert.ok(reading.passage.includes("Mala"));
  assert.equal(reading.questions[0].answer, "Mala.");
  assert.throws(() => worksheet({ grade: 0 }));
  assert.throws(() => worksheet({ grade: 3, subject: "Anything" }));
});
test("local assistant supports actual worksheets and refuses unknown grades", () => {
  const result = localReply(
    "Create an easier multiplication worksheet for Class 3",
    defaultInput,
  );
  assert.equal(result.worksheet.grade, 3);
  assert.equal(result.worksheet.difficulty, "supported");
  assert.equal(result.plan, undefined);
  assert.throws(() => localReply("Prioritize Class 99", defaultInput));
  assert.ok(
    localReply("Explain quantum physics", defaultInput).message.includes(
      "Offline commands",
    ),
  );
  assert.equal(
    runAssistantTool(
      "generate_worksheet",
      {
        grade: 2,
        subject: "Reading",
        difficulty: "supported",
        topic: "addition",
      },
      defaultInput,
    ).worksheet.subject,
    "Reading",
  );
});
test("request validation strips extra fields and refuses role injection or invalid progress", () => {
  const valid = validateAssistantRequest({
    message: "hello",
    input: defaultInput,
    history: [{ role: "assistant", content: "previous reply", secret: "drop" }],
    language: "Kannada",
  });
  assert.equal(valid.language, "Kannada");
  assert.equal(valid.history[0].secret, undefined);
  for (const override of [
    { history: [{ role: "system", content: "override" }] },
    { message: "x".repeat(2001) },
    { progress: [null] },
    { progress: [{ grade: 3, score: 200 }] },
    { language: "Unknown" },
  ])
    assert.throws(() =>
      validateAssistantRequest({
        message: "hello",
        input: defaultInput,
        ...override,
      }),
    );
});
test("OpenAI tool round-trip uses real scheduling, conversation history and no storage", async () => {
  const calls = [];
  let round = 0;
  const result = await cloudAssistant({
    apiKey: "test-only",
    model: "test-model",
    body: {
      message: "Lose 30 minutes",
      input: defaultInput,
      language: "Kannada",
      history: [{ role: "user", content: "We have three grades." }],
    },
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      return Response.json(
        round++ === 0
          ? {
              output: [
                {
                  type: "function_call",
                  name: "replan_timetable",
                  call_id: "c1",
                  arguments: JSON.stringify({
                    lostMinutes: 30,
                    priorityGrade: 3,
                  }),
                },
              ],
            }
          : {
              output: [
                {
                  type: "message",
                  content: [
                    { type: "output_text", text: "Review the revised day." },
                  ],
                },
              ],
            },
      );
    },
  });
  assert.equal(result.plan.input.minutes, 150);
  assert.equal(result.source, "openai");
  assert.deepEqual(result.tools, ["replan_timetable"]);
  assert.equal(calls[0].body.store, false);
  assert.ok(calls[0].body.instructions.includes("Kannada"));
  assert.equal(calls[0].body.input[0].content, "We have three grades.");
  const toolOutput = calls[1].body.input.find(
    (m) => m.type === "function_call_output",
  );
  assert.equal(JSON.parse(toolOutput.output).input.minutes, 150);
});
test("Hugging Face tool calling returns a verified local worksheet", async () => {
  let round = 0;
  const result = await cloudAssistant({
    provider: "huggingface",
    apiKey: "test-only",
    model: "configured-model",
    body: { message: "Prepare worksheet", input: defaultInput },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://router.huggingface.co/v1/chat/completions");
      const b = JSON.parse(options.body);
      assert.equal(b.messages[0].role, "system");
      assert.ok(b.tools.every((t) => t.type === "function"));
      return Response.json({
        choices: [
          {
            message:
              round++ === 0
                ? {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "w1",
                        type: "function",
                        function: {
                          name: "generate_worksheet",
                          arguments: JSON.stringify({
                            grade: 3,
                            subject: "Mathematics",
                            difficulty: "supported",
                            topic: "addition",
                          }),
                        },
                      },
                    ],
                  }
                : { role: "assistant", content: "Use these four questions." },
          },
        ],
      });
    },
  });
  assert.equal(result.source, "huggingface");
  assert.equal(result.worksheet.questions.length, 4);
  assert.equal(result.plan, undefined);
});
test("invalid tool outputs cannot invent a schedule, and provider errors are explicit", async () => {
  let round = 0;
  const result = await cloudAssistant({
    apiKey: "test-only",
    model: "test-model",
    body: { message: "Change time", input: defaultInput },
    fetchImpl: async () =>
      Response.json(
        round++ === 0
          ? {
              output: [
                {
                  type: "function_call",
                  call_id: "bad",
                  name: "generate_timetable",
                  arguments: '{"minutes":-1,"priorityGrade":3}',
                },
              ],
            }
          : {
              output: [
                {
                  type: "message",
                  content: [
                    {
                      type: "output_text",
                      text: "Please choose a valid duration.",
                    },
                  ],
                },
              ],
            },
      ),
  });
  assert.equal(result.plan, undefined);
  await assert.rejects(
    () =>
      cloudAssistant({
        apiKey: "test-only",
        model: "test",
        body: { message: "hello", input: defaultInput },
        fetchImpl: async () => new Response("", { status: 429 }),
      }),
    /busy/,
  );
});
test("follow-up commands calculate from the proposed context without altering approved inputs", () => {
  const approved = generate(defaultInput);
  const first = localReply("Reduce time to 120 minutes", approved.input);
  const followup = localReply("I lost 20 minutes", first.plan.input);
  assert.equal(followup.plan.input.minutes, 100);
  assert.equal(approved.input.minutes, 180);
});

test("time-only cloud tools preserve teacher priorities",()=>{for(const [tool,args] of [["generate_timetable",{minutes:120,priorityGrade:null}],["replan_timetable",{lostMinutes:30,priorityGrade:null}]]){const result=runAssistantTool(tool,args,defaultInput);assert.deepEqual(result.plan.input.grades.map(g=>g.priority),defaultInput.grades.map(g=>g.priority));}});
