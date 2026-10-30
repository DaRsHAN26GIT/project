import { command, validate } from "./engine.mjs";
export function worksheet({
  grade,
  subject = "Mathematics",
  difficulty = "standard",
  topic = "multiplication",
}) {
  if (!Number.isInteger(grade) || grade < 1 || grade > 12)
    throw Error("Choose a valid grade.");
  if (!["supported", "standard", "stretch"].includes(difficulty))
    throw Error("Choose a supported difficulty.");
  if (!["Mathematics", "Reading"].includes(subject))
    throw Error("Worksheet templates support Mathematics and Reading.");
  const count = difficulty === "supported" ? 4 : 6;
  if (subject === "Reading") {
    const passage =
      "Mala planted three seeds near her school. She watered them every morning. One week later, tiny green leaves appeared. Mala and her friend Ravi measured the plants and drew them in a notebook. They left one plant in the shade to compare how it grew.";
    const questions = [
      ["Who planted the seeds?", "Mala."],
      ["How many seeds did Mala plant?", "Three."],
      ["When did she water them?", "Every morning."],
      ["What appeared after one week?", "Tiny green leaves."],
      [
        "How did the friends record their observations?",
        "They measured the plants and drew them in a notebook.",
      ],
      [
        "Why did they put one plant in the shade?",
        "To compare how it grew with the other plants.",
      ],
    ]
      .slice(0, count)
      .map(([prompt, answer]) => ({ prompt, answer }));
    return {
      title: "The little seed experiment",
      grade,
      subject,
      difficulty,
      passage,
      instructions:
        difficulty === "supported"
          ? "Read with a partner. Answer aloud or draw your answer."
          : "Read the passage. Answer in complete sentences and point to evidence in the story.",
      questions,
      checkpoint: "Ask the learner to retell the story in their own words.",
      source: "Local worksheet template",
    };
  }
  if (!["multiplication", "addition", "subtraction"].includes(topic))
    throw Error("Choose multiplication, addition, or subtraction.");
  const factor =
    difficulty === "supported"
      ? 2
      : difficulty === "stretch"
        ? Math.min(grade + 5, 15)
        : Math.min(grade + 1, 10);
  const questions = Array.from({ length: count }, (_, i) => {
    const a = factor + i,
      b = difficulty === "supported" ? 2 : Math.min(grade + 2, 12);
    return topic === "addition"
      ? { prompt: `${a} + ${b} = ___`, answer: String(a + b) }
      : topic === "subtraction"
        ? { prompt: `${a + b} − ${b} = ___`, answer: String(a) }
        : { prompt: `${a} × ${b} = ___`, answer: String(a * b) };
  });
  return {
    title: `Everyday ${topic}`,
    grade,
    subject,
    difficulty,
    instructions:
      difficulty === "supported"
        ? "Use seeds, stones, or drawings to show your thinking."
        : "Solve each question. Explain one answer with a drawing or equal groups.",
    questions,
    checkpoint:
      "Check the method as well as the answer. Ask a partner to explain a different method.",
    source: "Local worksheet template",
  };
}
export function localReply(text, input, options = {}) {
  validate(input);
  if (typeof text !== "string" || !text.trim() || text.length > 2000)
    throw Error("Enter a request of 1–2000 characters.");
  const mentioned = text.match(/class\s*(\d+)/i);
  const grade = mentioned
    ? Number(mentioned[1])
    : (options.grade ?? input.grades[0].id);
  if (!input.grades.some((g) => g.id === grade))
    throw Error(`Class ${grade} is not in this classroom.`);
  if (/worksheet|practice sheet|quiz/i.test(text)) {
    const subject = /read|story/i.test(text) ? "Reading" : "Mathematics";
    const topic = /subtract/i.test(text)
      ? "subtraction"
      : /addition|add numbers/i.test(text)
        ? "addition"
        : "multiplication";
    const sheet = worksheet({
      grade,
      subject,
      topic,
      difficulty: /easier|easy|support/i.test(text)
        ? "supported"
        : /hard|stretch/i.test(text)
          ? "stretch"
          : "standard",
    });
    return {
      message: `Here is a ${sheet.difficulty} Class ${grade} worksheet, built from a local template. Review the tasks before using them with learners.`,
      worksheet: sheet,
      source: "local",
    };
  }
  const result = command(text, input);
  return { ...result, source: "local" };
}
export function worksheetText(sheet, answers = false) {
  return `${sheet.title}\nClass ${sheet.grade} · ${sheet.subject} · ${sheet.difficulty}\nName: ______________  Date: ______________\n\n${sheet.instructions}\n${sheet.passage ? "\n" + sheet.passage + "\n" : ""}\n${sheet.questions.map((q, i) => `${i + 1}. ${q.prompt}${answers ? "\nAnswer: " + q.answer : "\n\n____________________________"}`).join("\n\n")}\n\nTeacher checkpoint: ${sheet.checkpoint}\n${sheet.source}`;
}
